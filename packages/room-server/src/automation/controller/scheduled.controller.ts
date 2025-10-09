/**
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

import { Body, Controller, Post } from '@nestjs/common';
import { InjectLogger } from 'shared/common';
import { Logger } from 'winston';
import { AutomationService } from '../services/automation.service';
import { RobotTriggerService } from '../services/robot.trigger.service';
import { TriggerEventHelper } from '../events/helpers/trigger.event.helper';

/**
 * 定时触发请求体
 */
export class ScheduledTriggerRo {
  /**
   * 机器人ID
   */
  robotId!: string;

  /**
   * 触发器ID
   */
  triggerId!: string;

  /**
   * 定时配置（可选）
   */
  scheduleConfig?: any;
}

/**
 * 定时任务触发控制器
 * 接收Java后台的定时触发请求
 */
@Controller('nest/v1/automation/scheduled')
export class ScheduledAutomationController {
  constructor(
    // @ts-ignore
    @InjectLogger() private readonly logger: Logger,
    private readonly automationService: AutomationService,
    private readonly robotTriggerService: RobotTriggerService,
    private readonly triggerEventHelper: TriggerEventHelper,
  ) {}

  /**
   * 触发定时任务执行
   * POST /nest/v1/automation/scheduled/trigger
   */
  @Post('/trigger')
  async triggerScheduledTask(@Body() body: ScheduledTriggerRo) {
    const { robotId, triggerId, scheduleConfig } = body;

    this.logger.info('ScheduledTrigger: Received trigger request', {
      robotId,
      triggerId,
    });

    try {
      // 获取触发器信息
      const trigger = await this.robotTriggerService.getTriggerByTriggerId(triggerId);

      if (!trigger) {
        this.logger.warn('ScheduledTrigger: Trigger not found', { triggerId });
        return {
          success: false,
          code: 404,
          message: 'Trigger not found',
        };
      }

      // 渲染触发器输入
      const triggerInput = trigger.input
        ? this.triggerEventHelper.renderInput(trigger.input)
        : {};

      // 准备触发输出
      const triggerOutput = {
        triggeredAt: new Date().toISOString(),
        triggerType: 'scheduled',
        triggerId: triggerId,
        scheduleConfig: scheduleConfig || {},
      };

      // 执行自动化任务
      const taskId = await this.automationService.handleTask(robotId, {
        triggerId,
        input: triggerInput,
        output: triggerOutput,
      });

      this.logger.info('ScheduledTrigger: Task executed successfully', {
        triggerId,
        robotId,
        taskId,
      });

      return {
        success: true,
        code: 200,
        message: 'Scheduled task triggered successfully',
        data: { taskId },
      };
    } catch (error) {
      this.logger.error('ScheduledTrigger: Error executing task', {
        triggerId,
        robotId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      return {
        success: false,
        code: 500,
        message: (error as Error).message,
      };
    }
  }
}
