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

package com.apitable.interfaces.automation.task;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.apitable.automation.mapper.AutomationTriggerMapper;
import com.apitable.automation.model.TriggerRO;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Scheduled Automation Task Executor.
 * Executes automation tasks by calling room-server API.
 *
 * @author APITable
 */
@Slf4j
@Component
public class ScheduledAutomationExecutor {

    @Resource
    private AutomationTriggerMapper automationTriggerMapper;

    /**
     * Room server base URL.
     */
    @Value("${room.server.url:http://localhost:3001}")
    private String roomServerUrl;

    /**
     * Request timeout in milliseconds.
     */
    private static final int REQUEST_TIMEOUT = 30000;

    /**
     * Execute scheduled automation task.
     *
     * @param robotId      robot ID
     * @param triggerId    trigger ID
     * @param config       schedule configuration
     */
    public void executeScheduledTask(String robotId, String triggerId, TriggerRO.TriggerScheduleConfig config) {
        log.info("Executing scheduled task: robotId={}, triggerId={}", robotId, triggerId);

        try {
            // Build request payload
            JSONObject payload = new JSONObject();
            payload.set("robotId", robotId);
            payload.set("triggerId", triggerId);
            payload.set("scheduleConfig", config);

            // Call room-server API
            String apiUrl = buildRoomServerApiUrl("/nest/v1/automation/scheduled/trigger");
            
            log.debug("Calling room-server API: url={}, payload={}", apiUrl, payload);
            
            HttpResponse response = HttpRequest.post(apiUrl)
                .header("Content-Type", "application/json")
                .body(payload.toString())
                .timeout(REQUEST_TIMEOUT)
                .execute();

            if (response.isOk()) {
                String responseBody = response.body();
                JSONObject result = JSONUtil.parseObj(responseBody);
                
                if (result.getBool("success", false)) {
                    String taskId = result.getByPath("data.taskId", String.class);
                    log.info("Scheduled task executed successfully: robotId={}, triggerId={}, taskId={}", 
                            robotId, triggerId, taskId);
                } else {
                    log.error("Scheduled task execution failed: robotId={}, triggerId={}, message={}", 
                            robotId, triggerId, result.getStr("message"));
                }
            } else {
                log.error("Failed to call room-server API: robotId={}, triggerId={}, status={}, response={}", 
                        robotId, triggerId, response.getStatus(), response.body());
            }
        } catch (Exception e) {
            log.error("Error executing scheduled task: robotId={}, triggerId={}", 
                    robotId, triggerId, e);
        }
    }

    /**
     * Build room-server API URL.
     *
     * @param path API path
     * @return full URL
     */
    private String buildRoomServerApiUrl(String path) {
        String baseUrl = roomServerUrl.endsWith("/") 
            ? roomServerUrl.substring(0, roomServerUrl.length() - 1) 
            : roomServerUrl;
        String apiPath = path.startsWith("/") ? path : "/" + path;
        return baseUrl + apiPath;
    }
}

