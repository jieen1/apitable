/*
 * APITable <https://github.com/apitable/apitable>
 * Copyright (C) 2022 APITable Ltd. <https://apitable.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package com.apitable.interfaces.automation.facede;

import cn.hutool.core.util.StrUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.apitable.automation.entity.AutomationRobotEntity;
import com.apitable.automation.entity.AutomationTriggerEntity;
import com.apitable.automation.enums.AutomationTriggerType;
import com.apitable.automation.mapper.AutomationRobotMapper;
import com.apitable.automation.mapper.AutomationTriggerMapper;
import com.apitable.automation.model.TriggerRO;
import com.apitable.automation.service.IAutomationTriggerTypeService;
import com.apitable.interfaces.automation.model.AutomationScheduleTask;
import com.apitable.interfaces.automation.task.ScheduledAutomationExecutor;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.Resource;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Scheduled Automation Service Facade Implementation.
 * Handles scheduled automation tasks execution without using Spring @Scheduled.
 *
 * @author APITable
 */
@Slf4j
@Service
public class ScheduledAutomationServiceFacadeImpl implements AutomationServiceFacade {

    /**
     * Store schedule configurations: triggerId -> TriggerScheduleConfig.
     */
    private final Map<String, TriggerRO.TriggerScheduleConfig> scheduleConfigMap = new ConcurrentHashMap<>();

    /**
     * Store schedule task metadata: triggerId -> AutomationScheduleTask.
     */
    private final Map<String, AutomationScheduleTask> scheduleTaskMap = new ConcurrentHashMap<>();

    /**
     * Scheduled executor for scanning tasks.
     */
    private ScheduledExecutorService scheduledExecutor;

    /**
     * Task executor for executing automation tasks.
     */
    private ScheduledExecutorService taskExecutor;

    @Resource
    private AutomationTriggerMapper automationTriggerMapper;

    @Resource
    private IAutomationTriggerTypeService automationTriggerTypeService;

    @Resource
    private ScheduledAutomationExecutor scheduledAutomationExecutor;

    @Resource
    private AutomationRobotMapper automationRobotMapper;

    /**
     * Scan interval in seconds (default: 60 seconds).
     */
    private static final long SCAN_INTERVAL_SECONDS = 60;

    /**
     * Initialize scheduler and load existing scheduled tasks.
     */
    @PostConstruct
    public void init() {
        log.info("Initializing Scheduled Automation Service...");

        // Create thread pools
        this.scheduledExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread thread = new Thread(r, "AutomationScheduler-Scanner");
            thread.setDaemon(true);
            return thread;
        });

        this.taskExecutor = Executors.newScheduledThreadPool(
                Runtime.getRuntime().availableProcessors(),
                r -> {
                    Thread thread = new Thread(r, "AutomationScheduler-Executor");
                    thread.setDaemon(true);
                    return thread;
                }
        );

        // Load existing scheduled triggers from database
        loadScheduledTriggers();

        // Start periodic scanner
        scheduledExecutor.scheduleAtFixedRate(
                this::scanAndExecuteTasks,
                0,
                SCAN_INTERVAL_SECONDS,
                TimeUnit.SECONDS
        );

        log.info("Scheduled Automation Service initialized successfully. "
                        + "Loaded {} scheduled tasks. Scan interval: {}s",
                scheduleConfigMap.size(), SCAN_INTERVAL_SECONDS);
    }

    /**
     * Shutdown scheduler gracefully.
     */
    @PreDestroy
    public void destroy() {
        log.info("Shutting down Scheduled Automation Service...");

        if (scheduledExecutor != null && !scheduledExecutor.isShutdown()) {
            scheduledExecutor.shutdown();
            try {
                if (!scheduledExecutor.awaitTermination(30, TimeUnit.SECONDS)) {
                    scheduledExecutor.shutdownNow();
                }
            } catch (InterruptedException e) {
                scheduledExecutor.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }

        if (taskExecutor != null && !taskExecutor.isShutdown()) {
            taskExecutor.shutdown();
            try {
                if (!taskExecutor.awaitTermination(30, TimeUnit.SECONDS)) {
                    taskExecutor.shutdownNow();
                }
            } catch (InterruptedException e) {
                taskExecutor.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }

        log.info("Scheduled Automation Service shut down successfully.");
    }

    /**
     * Load scheduled triggers from database.
     */
    private void loadScheduledTriggers() {
        try {
            String scheduleTriggerTypeId = automationTriggerTypeService.getTriggerTypeByEndpoint(
                    AutomationTriggerType.SCHEDULED_TIME_ARRIVE.getType());

            if (StrUtil.isBlank(scheduleTriggerTypeId)) {
                log.warn("Scheduled trigger type not found, skipping scheduled tasks loading");
                return;
            }

            List<AutomationTriggerEntity> triggers = automationTriggerMapper
                    .selectByTriggerTypeId(scheduleTriggerTypeId);

            if (triggers.isEmpty()) {
                log.info("No scheduled triggers found");
                return;
            }

            // Batch query all robots by robotIds
            List<String> robotIds = triggers.stream()
                    .map(AutomationTriggerEntity::getRobotId)
                    .distinct()
                    .toList();

            List<AutomationRobotEntity> robots = automationRobotMapper.selectList(
                    new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<AutomationRobotEntity>()
                            .in("robot_id", robotIds)
                            .eq("is_deleted", false)
                            .eq("is_active", true)
            );

            // Build robotId -> robot map for quick lookup
            Map<String, AutomationRobotEntity> robotMap = robots.stream()
                    .collect(java.util.stream.Collectors.toMap(
                            AutomationRobotEntity::getRobotId,
                            robot -> robot
                    ));

            // Filter and load triggers
            for (AutomationTriggerEntity trigger : triggers) {
                try {
                    AutomationRobotEntity robot = robotMap.get(trigger.getRobotId());

                    if (robot == null) {
                        log.debug("Robot not found or not active for trigger: triggerId={}, robotId={}",
                                trigger.getTriggerId(), trigger.getRobotId());
                        continue;
                    }

                    TriggerRO.TriggerScheduleConfig config = parseScheduleConfig(trigger.getInput());
                    if (config != null && isValidScheduleConfig(config)) {
                        scheduleConfigMap.put(trigger.getTriggerId(), config);
                        scheduleTaskMap.put(trigger.getTriggerId(),
                                new AutomationScheduleTask(
                                        trigger.getTriggerId(),
                                        trigger.getRobotId(),
                                        config
                                )
                        );
                        log.debug("Loaded scheduled task: triggerId={}, robotId={}, config={}",
                                trigger.getTriggerId(), trigger.getRobotId(), config);
                    }
                } catch (Exception e) {
                    log.error("Failed to load scheduled task for triggerId: {}",
                            trigger.getTriggerId(), e);
                }
            }

            log.info("Loaded {} active scheduled tasks from {} triggers",
                    scheduleTaskMap.size(), triggers.size());
        } catch (Exception e) {
            log.error("Failed to load scheduled triggers from database", e);
        }
    }

    /**
     * Scan and execute tasks that should run at current time.
     */
    private void scanAndExecuteTasks() {
        try {
            ZonedDateTime now = ZonedDateTime.now();

            if (scheduleTaskMap.isEmpty()) {
                return;
            }

            // Batch query all robots to check active status
            List<String> robotIds = scheduleTaskMap.values().stream()
                    .map(AutomationScheduleTask::getRobotId)
                    .distinct()
                    .toList();

            List<AutomationRobotEntity> activeRobots = automationRobotMapper.selectList(
                    new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<AutomationRobotEntity>()
                            .in("robot_id", robotIds)
                            .eq("is_deleted", false)
                            .eq("is_active", true)
            );

            // Build active robot set for quick lookup
            Set<String> activeRobotIds = activeRobots.stream()
                    .map(AutomationRobotEntity::getRobotId)
                    .collect(java.util.stream.Collectors.toSet());

            // Iterate and check execution
            for (Map.Entry<String, AutomationScheduleTask> entry : scheduleTaskMap.entrySet()) {
                String triggerId = entry.getKey();
                AutomationScheduleTask task = entry.getValue();
                TriggerRO.TriggerScheduleConfig config = task.getScheduleConfig();

                try {
                    // Check if robot is still active
                    if (!activeRobotIds.contains(task.getRobotId())) {
                        log.debug("Robot is not active, removing from schedule: triggerId={}, robotId={}",
                                triggerId, task.getRobotId());
                        scheduleConfigMap.remove(triggerId);
                        scheduleTaskMap.remove(triggerId);
                        continue;
                    }

                    if (shouldExecuteNow(config, now)) {
                        // Check if already executed in this minute
                        if (task.canExecute(now)) {
                            log.info("Triggering scheduled automation: triggerId={}, robotId={}",
                                    triggerId, task.getRobotId());

                            // Execute task asynchronously
                            taskExecutor.execute(() -> {
                                try {
                                    scheduledAutomationExecutor.executeScheduledTask(
                                            task.getRobotId(),
                                            triggerId,
                                            config
                                    );
                                    task.markExecuted(now);
                                } catch (Exception e) {
                                    log.error("Failed to execute scheduled task: triggerId={}, robotId={}",
                                            triggerId, task.getRobotId(), e);
                                }
                            });
                        } else {
                            log.debug("Task already executed in this minute: triggerId={}", triggerId);
                        }
                    }
                } catch (Exception e) {
                    log.error("Error checking task execution: triggerId={}", triggerId, e);
                }
            }
        } catch (Exception e) {
            log.error("Error in scanAndExecuteTasks", e);
        }
    }

    /**
     * Check if task should execute at current time.
     */
    private boolean shouldExecuteNow(TriggerRO.TriggerScheduleConfig config, ZonedDateTime now) {
        try {
            ZonedDateTime taskTime = now.withZoneSameInstant(ZoneId.of(config.getTimeZone()));
            return matchesCronField(config.getMinute(), taskTime.getMinute())
                    && matchesCronField(config.getHour(), taskTime.getHour())
                    && matchesCronField(config.getDayOfMonth(), taskTime.getDayOfMonth())
                    && matchesCronField(config.getMonth(), taskTime.getMonthValue())
                    && matchesCronField(config.getDayOfWeek(), taskTime.getDayOfWeek().getValue());
        } catch (Exception e) {
            log.error("Error checking task execution time: {}", config, e);
            return false;
        }
    }

    /**
     * Match cron field with current value.
     */
    private boolean matchesCronField(String cronField, int currentValue) {
        if ("*".equals(cronField)) {
            return true;
        }

        try {
            // Handle specific value
            if (cronField.matches("\\d+")) {
                return Integer.parseInt(cronField) == currentValue;
            }

            // Handle range (e.g., "1-5")
            if (cronField.contains("-")) {
                String[] parts = cronField.split("-");
                int start = Integer.parseInt(parts[0]);
                int end = Integer.parseInt(parts[1]);
                return currentValue >= start && currentValue <= end;
            }

            // Handle list (e.g., "1,3,5")
            if (cronField.contains(",")) {
                String[] values = cronField.split(",");
                for (String value : values) {
                    if (Integer.parseInt(value.trim()) == currentValue) {
                        return true;
                    }
                }
                return false;
            }

            // Handle step values (e.g., "*/5")
            if (cronField.contains("/")) {
                String[] parts = cronField.split("/");
                int step = Integer.parseInt(parts[1]);
                return currentValue % step == 0;
            }
        } catch (Exception e) {
            log.error("Error matching cron field: field={}, value={}", cronField, currentValue, e);
        }

        return false;
    }

    /**
     * Parse schedule config from trigger input JSON.
     * The input is in Expression format from frontend:
     * {
     *   "type": "Expression",
     *   "value": {
     *     "operator": "newObject",
     *     "operands": [
     *       "scheduleRule", { "type": "Expression", "value": { "operator": "newObject", "operands": [...] } },
     *       "timeZone", { "type": "Literal", "value": "Asia/Shanghai" }
     *     ]
     *   }
     * }
     */
    private TriggerRO.TriggerScheduleConfig parseScheduleConfig(String inputJson) {
        try {
            if (StrUtil.isBlank(inputJson)) {
                return null;
            }

            JSONObject json = JSONUtil.parseObj(inputJson);

            if (json.isEmpty()) {
                return null;
            }

            // Get the timeZone from root level
            String timeZone = getDataParameter(json, "timeZone");
            if (StrUtil.isBlank(timeZone)) {
                timeZone = "Asia/Shanghai";
            }

            // Get the scheduleRule nested object
            JSONObject scheduleRule = getDataSlot(json, "scheduleRule");
            if (scheduleRule == null) {
                log.warn("scheduleRule not found in input: {}", inputJson);
                return null;
            }

            // Extract cron fields from scheduleRule
            TriggerRO.TriggerScheduleConfig config = new TriggerRO.TriggerScheduleConfig();
            config.setSecond(getDataParameter(scheduleRule, "second"));
            config.setMinute(getDataParameter(scheduleRule, "minute"));
            config.setHour(getDataParameter(scheduleRule, "hour"));
            config.setMonth(getDataParameter(scheduleRule, "month"));
            config.setDayOfMonth(getDataParameter(scheduleRule, "dayOfMonth"));
            config.setDayOfWeek(getDataParameter(scheduleRule, "dayOfWeek"));
            config.setTimeZone(timeZone);

            // Set default values if not present
            if (StrUtil.isBlank(config.getSecond())) {
                config.setSecond("0");
            }
            if (StrUtil.isBlank(config.getMinute())) {
                config.setMinute("*");
            }
            if (StrUtil.isBlank(config.getHour())) {
                config.setHour("*");
            }
            if (StrUtil.isBlank(config.getMonth())) {
                config.setMonth("*");
            }
            if (StrUtil.isBlank(config.getDayOfMonth())) {
                config.setDayOfMonth("*");
            }
            if (StrUtil.isBlank(config.getDayOfWeek())) {
                config.setDayOfWeek("*");
            }

            log.info("Parsed schedule config: {}", config);
            return config;
        } catch (Exception e) {
            log.error("Failed to parse schedule config from input: {}", inputJson, e);
            return null;
        }
    }

    /**
     * Get parameter value from Expression operands.
     * Equivalent to frontend's getDataParameter function.
     * 
     * @param expression Expression object
     * @param fieldName  Field name to extract
     * @return Field value or null
     */
    private String getDataParameter(JSONObject expression, String fieldName) {
        try {
            if (expression == null || !"Expression".equals(expression.getStr("type"))) {
                return null;
            }

            JSONObject value = expression.getJSONObject("value");
            if (value == null) {
                return null;
            }

            cn.hutool.json.JSONArray operands = value.getJSONArray("operands");
            if (operands == null || operands.isEmpty()) {
                return null;
            }

            // Find the field name in operands array
            for (int i = 0; i < operands.size(); i++) {
                Object item = operands.get(i);
                if (fieldName.equals(item)) {
                    // Next item is the value object
                    if (i + 1 < operands.size()) {
                        JSONObject valueObj = operands.getJSONObject(i + 1);
                        if (valueObj != null && "Literal".equals(valueObj.getStr("type"))) {
                            return valueObj.getStr("value");
                        }
                    }
                    break;
                }
            }

            return null;
        } catch (Exception e) {
            log.error("Failed to get data parameter: fieldName={}", fieldName, e);
            return null;
        }
    }

    /**
     * Get nested Expression object from operands.
     * Equivalent to frontend's getDataSlot function.
     * 
     * @param expression Expression object
     * @param fieldName  Field name to extract
     * @return Nested Expression object or null
     */
    private JSONObject getDataSlot(JSONObject expression, String fieldName) {
        try {
            if (expression == null || !"Expression".equals(expression.getStr("type"))) {
                return null;
            }

            JSONObject value = expression.getJSONObject("value");
            if (value == null) {
                return null;
            }

            cn.hutool.json.JSONArray operands = value.getJSONArray("operands");
            if (operands == null || operands.isEmpty()) {
                return null;
            }

            // Find the field name in operands array
            for (int i = 0; i < operands.size(); i++) {
                Object item = operands.get(i);
                if (fieldName.equals(item)) {
                    // Next item is the nested Expression object
                    if (i + 1 < operands.size()) {
                        return operands.getJSONObject(i + 1);
                    }
                    break;
                }
            }

            return null;
        } catch (Exception e) {
            log.error("Failed to get data slot: fieldName={}", fieldName, e);
            return null;
        }
    }

    /**
     * Validate schedule configuration.
     */
    private boolean isValidScheduleConfig(TriggerRO.TriggerScheduleConfig config) {
        return config != null
                && StrUtil.isNotBlank(config.getMinute())
                && StrUtil.isNotBlank(config.getHour())
                && StrUtil.isNotBlank(config.getMonth())
                && StrUtil.isNotBlank(config.getDayOfMonth())
                && StrUtil.isNotBlank(config.getDayOfWeek())
                && StrUtil.isNotBlank(config.getTimeZone());
    }

    @Override
    public void publishSchedule(Long scheduleId) {
        // Not implemented - not needed for this simple scheduler
        log.debug("publishSchedule called with scheduleId: {}", scheduleId);
    }

    @Override
    public void createSchedule(String spaceId, String triggerId, String scheduleConfig) {
        log.info("Creating schedule: triggerId={}, spaceId={}, config={}",
                triggerId, spaceId, scheduleConfig);

        try {
            JSONObject configJson = JSONUtil.parseObj(scheduleConfig);
            TriggerRO.TriggerScheduleConfig config = new TriggerRO.TriggerScheduleConfig();
            config.setSecond(configJson.getStr("second", "0"));
            config.setMinute(configJson.getStr("minute", "*"));
            config.setHour(configJson.getStr("hour", "*"));
            config.setMonth(configJson.getStr("month", "*"));
            config.setDayOfMonth(configJson.getStr("dayOfMonth", "*"));
            config.setDayOfWeek(configJson.getStr("dayOfWeek", "*"));
            config.setTimeZone(configJson.getStr("timeZone", "UTC"));

            if (isValidScheduleConfig(config)) {
                // Get robot ID
                AutomationTriggerEntity trigger = automationTriggerMapper.selectByTriggerId(triggerId);
                if (trigger != null) {
                    scheduleConfigMap.put(triggerId, config);
                    scheduleTaskMap.put(triggerId,
                            new AutomationScheduleTask(triggerId, trigger.getRobotId(), config));
                    log.info("Schedule created successfully: triggerId={}", triggerId);
                } else {
                    log.error("Trigger not found: triggerId={}", triggerId);
                }
            } else {
                log.error("Invalid schedule config: {}", config);
            }
        } catch (Exception e) {
            log.error("Failed to create schedule: triggerId={}", triggerId, e);
        }
    }

    @Override
    public void updateSchedule(String triggerId, String scheduleConfig) {
        log.info("Updating schedule: triggerId={}, config={}", triggerId, scheduleConfig);

        try {
            JSONObject configJson = JSONUtil.parseObj(scheduleConfig);
            TriggerRO.TriggerScheduleConfig config = new TriggerRO.TriggerScheduleConfig();
            config.setSecond(configJson.getStr("second", "0"));
            config.setMinute(configJson.getStr("minute", "*"));
            config.setHour(configJson.getStr("hour", "*"));
            config.setMonth(configJson.getStr("month", "*"));
            config.setDayOfMonth(configJson.getStr("dayOfMonth", "*"));
            config.setDayOfWeek(configJson.getStr("dayOfWeek", "*"));
            config.setTimeZone(configJson.getStr("timeZone", "UTC"));

            if (isValidScheduleConfig(config)) {
                AutomationScheduleTask existingTask = scheduleTaskMap.get(triggerId);
                if (existingTask != null) {
                    scheduleConfigMap.put(triggerId, config);
                    scheduleTaskMap.put(triggerId,
                            new AutomationScheduleTask(
                                    triggerId,
                                    existingTask.getRobotId(),
                                    config
                            ));
                    log.info("Schedule updated successfully: triggerId={}", triggerId);
                } else {
                    log.warn("Schedule not found for update: triggerId={}", triggerId);
                    // Try to create it
                    AutomationTriggerEntity trigger = automationTriggerMapper.selectByTriggerId(triggerId);
                    if (trigger != null) {
                        scheduleConfigMap.put(triggerId, config);
                        scheduleTaskMap.put(triggerId,
                                new AutomationScheduleTask(triggerId, trigger.getRobotId(), config));
                        log.info("Schedule created during update: triggerId={}", triggerId);
                    }
                }
            } else {
                log.error("Invalid schedule config for update: {}", config);
            }
        } catch (Exception e) {
            log.error("Failed to update schedule: triggerId={}", triggerId, e);
        }
    }

    @Override
    public void deleteSchedule(String triggerId, Long userId) {
        log.info("Deleting schedule: triggerId={}, userId={}", triggerId, userId);

        scheduleConfigMap.remove(triggerId);
        scheduleTaskMap.remove(triggerId);

        log.info("Schedule deleted successfully: triggerId={}", triggerId);
    }

    @Override
    public void copy(Map<String, String> newTriggerMap) {
        log.info("Copying schedules: count={}", newTriggerMap.size());

        for (Map.Entry<String, String> entry : newTriggerMap.entrySet()) {
            String oldTriggerId = entry.getKey();
            String newTriggerId = entry.getValue();

            TriggerRO.TriggerScheduleConfig config = scheduleConfigMap.get(oldTriggerId);
            if (config != null) {
                AutomationTriggerEntity trigger = automationTriggerMapper.selectByTriggerId(newTriggerId);
                if (trigger != null) {
                    scheduleConfigMap.put(newTriggerId, config);
                    scheduleTaskMap.put(newTriggerId,
                            new AutomationScheduleTask(newTriggerId, trigger.getRobotId(), config));
                    log.debug("Copied schedule: {} -> {}", oldTriggerId, newTriggerId);
                }
            }
        }

        log.info("Schedule copy completed");
    }
}

