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

package com.apitable.interfaces.automation.model;

import com.apitable.automation.model.TriggerRO;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.atomic.AtomicReference;
import lombok.Getter;

/**
 * Automation Schedule Task Metadata.
 * Tracks task execution state to prevent duplicate execution in same minute.
 *
 * @author APITable
 */
@Getter
public class AutomationScheduleTask {

    /**
     * Trigger ID.
     */
    private final String triggerId;

    /**
     * Robot ID.
     */
    private final String robotId;

    /**
     * Schedule configuration.
     */
    private final TriggerRO.TriggerScheduleConfig scheduleConfig;

    /**
     * Last execution time (truncated to minute).
     */
    private final AtomicReference<ZonedDateTime> lastExecutionTime;

    /**
     * Constructor.
     *
     * @param triggerId      trigger ID
     * @param robotId        robot ID
     * @param scheduleConfig schedule configuration
     */
    public AutomationScheduleTask(String triggerId, String robotId, TriggerRO.TriggerScheduleConfig scheduleConfig) {
        this.triggerId = triggerId;
        this.robotId = robotId;
        this.scheduleConfig = scheduleConfig;
        this.lastExecutionTime = new AtomicReference<>();
    }

    /**
     * Check if task can execute at given time.
     * Prevents duplicate execution within same minute.
     *
     * @param currentTime current time
     * @return true if can execute, false if already executed in this minute
     */
    public boolean canExecute(ZonedDateTime currentTime) {
        ZonedDateTime currentMinute = currentTime.truncatedTo(ChronoUnit.MINUTES);
        ZonedDateTime lastExecution = lastExecutionTime.get();

        if (lastExecution == null) {
            return true;
        }

        // Check if current minute is different from last execution minute
        return !currentMinute.equals(lastExecution.truncatedTo(ChronoUnit.MINUTES));
    }

    /**
     * Mark task as executed at given time.
     *
     * @param executionTime execution time
     */
    public void markExecuted(ZonedDateTime executionTime) {
        lastExecutionTime.set(executionTime.truncatedTo(ChronoUnit.MINUTES));
    }

    /**
     * Reset execution state.
     */
    public void reset() {
        lastExecutionTime.set(null);
    }

    @Override
    public String toString() {
        return String.format("AutomationScheduleTask{triggerId='%s', robotId='%s', "
                        + "config=%s, lastExecution=%s}",
                triggerId, robotId, scheduleConfig, lastExecutionTime.get());
    }
}

