# 自动化数据表操作Action设计文档

## 文档说明

本文档定义了在APITable自动化系统中添加数据表操作Action（新增记录、修改记录、查找记录）的完整设计方案。本文档作为后续实现的**强制性规范**，所有实现必须严格按照本设计执行。

**文档版本**：v1.0  
**创建日期**：2024  
**适用范围**：自动化Action系统扩展

---

## 目录

1. [需求概述](#需求概述)
2. [现有机制分析](#现有机制分析)
3. [核心问题与约束](#核心问题与约束)
4. [设计方案](#设计方案)
5. [技术实现细节](#技术实现细节)
6. [实施步骤](#实施步骤)
7. [验收标准](#验收标准)
8. [注意事项与风险](#注意事项与风险)

---

## 1. 需求概述

### 1.1 业务需求

在自动化系统中添加三个新的Action，用于操作数据表记录：

1. **新增记录Action**：在指定数据表中创建新记录
2. **修改记录Action**：更新数据表中已存在的记录
3. **查找记录Action**：根据条件查询数据表中的记录

### 1.2 功能要求

1. Action必须支持通过动态表达式获取上一步或触发器的数据
2. Action的output必须包含记录的完整字段数据，供后续步骤使用
3. 必须保持与现有系统的兼容性，不能破坏已有功能
4. 必须使用装饰器类的方式注册Action（`@AutomationAction`）

### 1.3 技术约束

1. **不能修改现有结构**：不能将output改为扁平化结构，否则会破坏兼容性
2. **必须保持向后兼容**：已有的action output结构必须保持不变
3. **必须参考现有实现**：记录操作逻辑必须参考`FusionApiService`等现有服务
4. **配置在代码中**：使用装饰器类，配置定义在代码中而非数据库

---

## 2. 现有机制分析

### 2.1 Action注册机制

APITable自动化系统支持三种Action注册方式：

#### 方式1：HTTP/HTTPS协议
- 协议：`http://` 或 `https://`
- 格式：`https://<serviceBaseURL>/<endpoint>`
- 特点：外部服务，通过HTTP请求调用

#### 方式2：automation://协议
- 协议：`automation://`
- 格式：`automation://<serviceSlug>/<endpoint>`
- 特点：本地/官方服务，配置存储在数据库中
- 示例：`automation://webhook/sendRequest`

#### 方式3：action://协议（装饰器类）
- 协议：`action://`
- 格式：`action://<nameHash>/endpoint`
- 特点：装饰器注册的自定义Action，配置在代码中
- **本需求采用此方式**

### 2.2 @AutomationAction装饰器机制

```typescript
// 装饰器定义
@AutomationAction(name: string, option?: IAutomationActionOption)

// 注册流程
1. 装饰器执行时，计算name的MD5哈希值作为nameHash
2. 创建actionTypeId: `custom_${nameHash}`
3. 将action实例注册到customActionMap
4. 将actionType信息注册到customActionTypeMap和customActionTypeMetas
```

**关键代码位置**：
- `packages/room-server/src/automation/actions/decorators/automation.action.decorator.ts`
- `packages/room-server/src/automation/actions/interface/base.action.ts`

### 2.3 Action执行流程

```typescript
// 执行流程
1. AutomationRobotRunner.executeAction(actionId)
2. 解析actionRuntimeInput（使用InputParser处理动态表达式）
3. AutomationService.getActionOutput(actionRuntimeInput, actionType)
4. 根据baseUrl协议分发：
   - action:// -> 从customActionMap获取实例，调用endpoint方法
   - automation:// -> 从services[serviceSlug][endpoint]获取函数调用
   - http/https -> 发送HTTP请求
5. 保存output到context[actionId].output
6. 继续执行下一个action
```

**关键代码位置**：
- `packages/core/src/automation_manager/automation_robot_runner.ts`
- `packages/room-server/src/automation/services/automation.service.ts`

### 2.4 动态表达式机制

```typescript
// 动态表达式访问方式
getObjectProperty(getNodeOutput(nodeId), ['property1', 'property2'])

// 示例
getObjectProperty(getNodeOutput('triggerId1'), ['datasheet', 'name'])
// 等价于：context['triggerId1'].output.datasheet.name

// 支持的函数
- getNodeOutput(nodeId): 获取节点的output
- getObjectProperty(obj, paths[]): 访问对象的嵌套属性
- concatString(...): 字符串拼接
- newArray(...): 创建数组
- newObject(...): 创建对象
```

**关键代码位置**：
- `packages/core/src/automation_manager/magic_variable/sys_functions/`
- `packages/core/src/automation_manager/input_parser.ts`

### 2.5 Trigger Output结构（参考）

Trigger的output同时支持两种结构：

```typescript
// 旧结构（兼容性）
{
  datasheet: { id, name },
  record: {
    id,
    url,
    fields: { [fieldId]: value }  // 字段数据
  }
}

// 新结构（扁平化）
{
  datasheetId,
  datasheetName,
  recordId,
  recordUrl,
  ...eventFields,  // 字段值直接展开
  clickedBy
}
```

**关键点**：
- Trigger的output包含完整的字段数据（通过`transformOpFields`转换）
- 字段数据使用OpenValue格式
- Output Schema会在前端动态扩展，包含所有字段定义

### 2.6 记录操作现有实现

系统已实现数据表记录操作的完整逻辑：

#### FusionApiService
- 位置：`packages/room-server/src/fusion/services/fusion.api.service.ts`
- 方法：
  - `addRecords(dstId, body, viewId)`: 新增记录
  - `updateRecords(dstId, body, viewId)`: 更新记录
  - `getRecords(dstId, query)`: 查询记录

#### 核心服务依赖
- `DataBusService`: 获取Datasheet实例
- `DatasheetRecordService`: 查询记录
- `NodeService`: 节点信息和权限检查
- `DatasheetRecordSourceService`: 记录来源追踪

#### 记录数据转换
- `transformOpFields`: 将cellValue转换为OpenValue格式
- 位置：`packages/core/src/event_manager/helper.ts`

---

## 3. 核心问题与约束

### 3.1 核心问题

**问题**：如果action的output中只定义了基础字段（recordId、url等），而没有字段数据的具体内容，后续步骤能否通过动态表达式访问到记录的字段值？

**答案**：**不能！** 如果output中没有包含字段数据，后续步骤无法访问字段内容。

### 3.2 约束条件

1. **不能破坏现有结构**：不能将output改为扁平化结构
2. **必须保持向后兼容**：已有的action output结构必须保持不变
3. **必须包含字段数据**：output必须包含完整的字段数据，供后续步骤使用
4. **必须支持动态表达式**：字段数据必须可通过动态表达式访问

### 3.3 设计原则

1. **向后兼容**：基础字段保持在顶层，结构不变
2. **扩展而非修改**：通过添加`fields`对象扩展功能
3. **结构清晰**：字段数据组织在`fields`对象中
4. **易于扩展**：前端可以动态扩展schema

---

## 4. 设计方案

### 4.1 Action Output数据结构设计

#### 4.1.1 单个记录场景（新增记录、修改记录）

```typescript
{
  // 基础字段（必须保持，向后兼容）
  datasheetId: string,        // 数据表ID
  datasheetName: string,       // 数据表名称
  recordId: string,            // 记录ID
  recordUrl: string,          // 记录URL
  
  // 扩展字段（新增）
  fields: {                    // 字段数据对象
    [fieldId: string]: BasicOpenValueType | null
  }
}
```

**字段说明**：
- `datasheetId`: 数据表ID，字符串类型
- `datasheetName`: 数据表名称，字符串类型
- `recordId`: 记录ID，字符串类型
- `recordUrl`: 记录URL，字符串类型
- `fields`: 字段数据对象，key为fieldId，value为OpenValue格式的字段值

#### 4.1.2 多个记录场景（查找记录）

```typescript
{
  records: [                   // 记录数组
    {
      datasheetId: string,
      datasheetName: string,
      recordId: string,
      recordUrl: string,
      fields: {                 // 每条记录的字段数据
        [fieldId: string]: BasicOpenValueType | null
      }
    },
    // ... 更多记录
  ],
  count: number                // 记录总数
}
```

**字段说明**：
- `records`: 记录数组，每个元素包含完整的记录信息（包括字段数据）
- `count`: 记录总数，数字类型

### 4.2 Output Schema设计

#### 4.2.1 单个记录场景的Schema

```typescript
{
  type: 'object',
  properties: {
    datasheetId: {
      type: 'string',
      title: 'Datasheet ID'
    },
    datasheetName: {
      type: 'string',
      title: 'Datasheet Name'
    },
    recordId: {
      type: 'string',
      title: 'Record ID'
    },
    recordUrl: {
      type: 'string',
      title: 'Record URL'
    },
    fields: {                    // fields对象定义
      type: 'object',
      title: 'Fields',
      properties: {}             // 字段定义会在运行时动态扩展
    }
  },
  required: ['datasheetId', 'datasheetName', 'recordId', 'recordUrl', 'fields']
}
```

#### 4.2.2 多个记录场景的Schema

```typescript
{
  type: 'object',
  properties: {
    records: {
      type: 'array',
      title: 'Records',
      items: {
        type: 'object',
        properties: {
          datasheetId: { type: 'string', title: 'Datasheet ID' },
          datasheetName: { type: 'string', title: 'Datasheet Name' },
          recordId: { type: 'string', title: 'Record ID' },
          recordUrl: { type: 'string', title: 'Record URL' },
          fields: {
            type: 'object',
            title: 'Fields',
            properties: {}       // 字段定义会在运行时动态扩展
          }
        },
        required: ['datasheetId', 'datasheetName', 'recordId', 'recordUrl', 'fields']
      }
    },
    count: {
      type: 'number',
      title: 'Count'
    }
  },
  required: ['records', 'count']
}
```

**关键点**：
- `fields`对象的`properties`在定义时为空
- 前端会在运行时动态扩展`fields.properties`，添加所有字段定义
- 基础字段的schema定义在代码中，必须完整

### 4.3 Action类设计

#### 4.3.1 新增记录Action

```typescript
@AutomationAction('新增记录', {
  description: '在指定数据表中创建新记录',
  themeLogo: { light: '...' }
})
export class AddRecordAction implements IBaseAction {
  // 依赖注入的服务
  constructor(
    private readonly databusService: DataBusService,
    private readonly nodeService: NodeService,
    private readonly datasheetRecordSourceService: DatasheetRecordSourceService,
    // ... 其他依赖
  ) {}

  async endpoint(input: AddRecordActionInput): Promise<IActionResponse<AddRecordOutput>> {
    // 1. 参数验证
    // 2. 权限检查
    // 3. 执行新增记录操作
    // 4. 获取记录数据
    // 5. 转换字段数据
    // 6. 构建output
  }

  getInputSchema(): IJsonSchema {
    // 定义输入schema
  }

  getUISchema(): IUiSchema {
    // 定义UI schema
  }

  getOutputSchema(): IJsonSchema {
    // 定义输出schema（单个记录场景）
  }
}
```

#### 4.3.2 修改记录Action

```typescript
@AutomationAction('修改记录', {
  description: '更新数据表中的记录',
  themeLogo: { light: '...' }
})
export class UpdateRecordAction implements IBaseAction {
  // 类似AddRecordAction的结构
}
```

#### 4.3.3 查找记录Action

```typescript
@AutomationAction('查找记录', {
  description: '根据条件查询数据表中的记录',
  themeLogo: { light: '...' }
})
export class FindRecordAction implements IBaseAction {
  // 类似AddRecordAction的结构，但output是多个记录场景
}
```

### 4.4 动态表达式访问方式

#### 4.4.1 单个记录场景

```typescript
// 访问基础字段
getObjectProperty(getNodeOutput(nodeId), ['recordId'])
// 返回: "rec123"

// 访问字段值
getObjectProperty(getNodeOutput(nodeId), ['fields', 'fldABC123'])
// 返回: 字段值（OpenValue格式）
```

#### 4.4.2 多个记录场景

```typescript
// 访问第一条记录的基础字段
getObjectProperty(getNodeOutput(nodeId), ['records', '0', 'recordId'])
// 返回: "rec123"

// 访问第一条记录的字段值
getObjectProperty(getNodeOutput(nodeId), ['records', '0', 'fields', 'fldABC123'])
// 返回: 字段值（OpenValue格式）

// 访问记录总数
getObjectProperty(getNodeOutput(nodeId), ['count'])
// 返回: 10
```

---

## 5. 技术实现细节

### 5.1 字段数据获取与转换

#### 5.1.1 获取记录数据

```typescript
// 1. 获取Datasheet实例
const datasheet = await this.databusService.getDatasheet(dstId, {
  loadOptions: {
    auth,
    recordIds: [recordId],  // 需要获取的记录ID
    includeCommentCount: false,
  },
});

// 2. 获取记录
const record = await datasheet.getRecord(recordId);
if (!record) {
  throw new Error('Record not found');
}
```

#### 5.1.2 转换字段数据

```typescript
import { transformOpFields } from '@apitable/core';

// 转换字段数据
const state = datasheet.store.getState();
const { eventFields } = transformOpFields({
  recordData: record.data,      // 记录的原始数据
  state,                         // Redux state
  datasheetId: dstId,
  recordId: record.id,
});

// eventFields格式: { [fieldId]: BasicOpenValueType | null }
```

**关键点**：
- `transformOpFields`会将cellValue转换为OpenValue格式
- 对于公式字段，会使用`cellValueToString`转换为字符串
- 对于其他字段，会使用`cellValueToOpenValue`转换为OpenValue格式

### 5.2 构建Action Output

#### 5.2.1 单个记录场景

```typescript
// 获取数据表名称
const datasheetName = await this.nodeService.getNameByNodeId(dstId);

// 构建output
const output = {
  datasheetId: dstId,
  datasheetName: datasheetName,
  recordId: record.id,
  recordUrl: getRecordUrl(dstId, record.id),
  fields: eventFields,  // 字段数据对象
};

return {
  success: true,
  data: {
    data: output,  // 注意：IActionResponse的data.data结构
  },
  code: ResponseStatusCodeEnums.Success,
};
```

#### 5.2.2 多个记录场景

```typescript
// 获取多条记录
const records = await view.getRecords();

// 批量转换字段数据
const outputs = await Promise.all(
  records.map(async (record) => {
    const { eventFields } = transformOpFields({
      recordData: record.data,
      state: datasheet.store.getState(),
      datasheetId: dstId,
      recordId: record.id,
    });
    
    const datasheetName = await this.nodeService.getNameByNodeId(dstId);
    
    return {
      datasheetId: dstId,
      datasheetName: datasheetName,
      recordId: record.id,
      recordUrl: getRecordUrl(dstId, record.id),
      fields: eventFields,
    };
  })
);

// 构建output
const output = {
  records: outputs,
  count: outputs.length,
};

return {
  success: true,
  data: {
    data: output,
  },
  code: ResponseStatusCodeEnums.Success,
};
```

### 5.3 依赖注入处理

#### 5.3.1 问题

装饰器类在注册时直接实例化，无法使用NestJS的依赖注入。

#### 5.3.2 解决方案

**方案1：修改AutomationService.getActionOutput（推荐）**

```typescript
// 在AutomationService中
case 'action:': {
  const connectorKey = url.hostname;
  // 从NestJS容器获取实例，而不是从customActionMap
  const connector = this.moduleRef.get(/* 根据connectorKey获取对应的类 */);
  const resp = await connector.endpoint(actionRuntimeInput);
  return {
    success: resp.success,
    data: resp.data as any,
  };
}
```

**方案2：延迟初始化（备选）**

```typescript
// 在装饰器中不立即实例化，而是保存类引用
// 在调用时从NestJS容器获取实例
```

**实施要求**：
- 必须实现依赖注入，确保Action类可以访问所需服务
- 不能破坏现有的装饰器注册机制

### 5.4 权限与用户上下文

#### 5.4.1 获取userId

```typescript
// 从robot信息获取
const robot = await this.automationRobotRepository.selectRobotById(robotId);
const userId = robot.createdBy;  // 或使用robot的userId
```

#### 5.4.2 构建auth对象

```typescript
// 需要构建IAuthHeader对象
// 参考现有实现，可能需要：
// 1. 从robot获取userId
// 2. 构建auth token或使用系统token
// 3. 确保权限检查通过
```

**实施要求**：
- 必须正确获取userId，用于权限检查和记录来源追踪
- 必须正确构建auth对象，确保DataBusService等服务的权限检查通过

### 5.5 参考现有实现

#### 5.5.1 新增记录参考

参考`FusionApiService.addRecords`方法：
- 位置：`packages/room-server/src/fusion/services/fusion.api.service.ts`
- 关键步骤：
  1. 参数验证：`checkDstRecordCount`
  2. 获取Datasheet：`databusService.getDatasheet`
  3. 执行新增：`datasheet.addRecords`
  4. 记录来源追踪：`datasheetRecordSourceService.createRecordSource`
  5. 返回结果：`getNewRecordListVo`

#### 5.5.2 修改记录参考

参考`FusionApiService.updateRecords`方法：
- 关键步骤：
  1. 参数验证：`validateRecordExists`, `validateArchivedRecordIncludes`
  2. 获取Datasheet：`databusService.getDatasheet`
  3. 执行更新：`datasheet.updateRecords`
  4. 重新加载记录：`datasheet.resetRecords`
  5. 返回结果：`getNewRecordListVo`

#### 5.5.3 查找记录参考

参考`FusionApiService.getRecords`方法：
- 关键步骤：
  1. 参数验证
  2. 获取Datasheet和View
  3. 执行查询：`view.getRecords`
  4. 转换结果：`getRecordViewObjects`

### 5.6 前端Schema扩展

#### 5.6.1 扩展函数实现

```typescript
// 前端需要实现类似enrichDatasheetTriggerOutputSchema的函数
export const enrichDatasheetActionOutputSchema = (
  nodeOutputSchema: INodeOutputSchema,
  fields: IField[],
  fieldPermissionMap: IFieldPermissionMap,
) => {
  return produce(nodeOutputSchema, (nodeOutputSchema) => {
    const enrichedFieldsSchema = fields2Schema(fields, fieldPermissionMap);
    
    // 检查是否有fields对象
    if (nodeOutputSchema.schema?.properties?.fields) {
      // 扩展fields对象的properties
      nodeOutputSchema.schema.properties.fields.properties = {
        ...nodeOutputSchema.schema.properties.fields.properties,
        ...enrichedFieldsSchema.properties,
      };
      
      // 更新uiSchema
      nodeOutputSchema.uiSchema = {
        layout: [
          {
            title: t(Strings.robot_variables_select_basics),
            items: ['datasheetId', 'datasheetName', 'recordId', 'recordUrl'],
          },
          {
            title: t(Strings.field),
            items: ['fields'],
          },
        ],
      };
    }
    
    return nodeOutputSchema;
  });
};
```

#### 5.6.2 Schema扩展时机

前端需要在以下时机扩展schema：
1. 获取action的output schema后
2. 识别action是否与datasheet相关（通过datasheetId参数）
3. 获取datasheet的字段列表
4. 调用`enrichDatasheetActionOutputSchema`扩展schema

---

## 6. 实施步骤

### 6.1 后端实施

#### 阶段1：基础框架搭建

1. **创建Action类文件**
   - `packages/room-server/src/automation/actions/datasheet/add-record.action.ts`
   - `packages/room-server/src/automation/actions/datasheet/update-record.action.ts`
   - `packages/room-server/src/automation/actions/datasheet/find-record.action.ts`

2. **定义输入输出接口**
   - `AddRecordActionInput`
   - `UpdateRecordActionInput`
   - `FindRecordActionInput`
   - `AddRecordOutput`
   - `UpdateRecordOutput`
   - `FindRecordOutput`

3. **实现IBaseAction接口**
   - `endpoint`方法（占位实现）
   - `getInputSchema`方法
   - `getUISchema`方法
   - `getOutputSchema`方法

#### 阶段2：依赖注入实现

1. **修改AutomationService.getActionOutput**
   - 实现从NestJS容器获取Action实例
   - 确保依赖注入正常工作

2. **注册Action类到NestJS模块**
   - 在AutomationActionModule中注册Action类
   - 确保可以被依赖注入

#### 阶段3：核心功能实现

1. **新增记录Action实现**
   - 参考`FusionApiService.addRecords`
   - 实现参数验证
   - 实现权限检查
   - 执行新增记录操作
   - 获取和转换字段数据
   - 构建output

2. **修改记录Action实现**
   - 参考`FusionApiService.updateRecords`
   - 实现完整的修改逻辑

3. **查找记录Action实现**
   - 参考`FusionApiService.getRecords`
   - 实现查询逻辑
   - 处理多条记录的字段数据转换


### 6.2 前端实施

#### 阶段1：Schema扩展功能

1. **实现enrichDatasheetActionOutputSchema函数**
   - 参考`enrichDatasheetTriggerOutputSchema`
   - 支持扩展action的fields对象

2. **识别需要扩展的Action**
   - 判断output schema是否包含fields对象
   - 判断是否与datasheet相关

#### 阶段2：UI支持

1. **Magic Variable选择器更新**
   - 支持选择fields对象
   - 支持在fields对象中选择字段

2. **动态表达式生成**
   - 生成正确的getObjectProperty表达式
   - 支持单个和多个记录场景

---

## 7. 验收标准

### 7.1 功能验收

#### 7.1.1 新增记录Action

- [ ] 可以在指定数据表中创建新记录
- [ ] output包含完整的字段数据
- [ ] 后续步骤可以通过动态表达式访问字段值
- [ ] 支持通过动态表达式设置字段值

#### 7.1.2 修改记录Action

- [ ] 可以更新指定记录
- [ ] output包含更新后的完整字段数据
- [ ] 后续步骤可以通过动态表达式访问字段值
- [ ] 支持通过动态表达式设置字段值

#### 7.1.3 查找记录Action

- [ ] 可以根据条件查询记录
- [ ] output包含所有查询结果的完整字段数据
- [ ] 后续步骤可以通过动态表达式访问每条记录的字段值
- [ ] 支持多条记录的遍历

### 7.2 兼容性验收

- [ ] 现有Action功能不受影响
- [ ] 现有自动化流程可以正常运行
- [ ] 动态表达式访问方式与现有方式兼容

### 7.3 性能验收

- [ ] 单个记录操作响应时间 < 1秒
- [ ] 批量查询（100条记录）响应时间 < 3秒
- [ ] 字段数据转换性能满足要求

### 7.4 代码质量验收

- [ ] 代码符合项目规范
- [ ] 有完整的单元测试覆盖
- [ ] 有完整的集成测试覆盖
- [ ] 代码注释完整

---

## 8. 注意事项与风险

### 8.1 注意事项

1. **字段数据获取时机**
   - 必须在记录操作完成后获取字段数据
   - 对于公式字段，需要重新计算

2. **权限检查**
   - 必须正确获取userId
   - 必须正确构建auth对象
   - 确保权限检查通过

3. **错误处理**
   - 必须处理记录不存在的情况
   - 必须处理权限不足的情况
   - 必须处理字段类型不匹配的情况

4. **性能考虑**
   - 对于查找记录返回大量记录的场景，需要批量获取字段数据
   - 考虑使用缓存优化
---

## 附录

### A. 关键代码位置

1. **Action注册机制**
   - `packages/room-server/src/automation/actions/decorators/automation.action.decorator.ts`
   - `packages/room-server/src/automation/actions/interface/base.action.ts`

2. **Action执行流程**
   - `packages/core/src/automation_manager/automation_robot_runner.ts`
   - `packages/room-server/src/automation/services/automation.service.ts`

3. **动态表达式**
   - `packages/core/src/automation_manager/magic_variable/sys_functions/`
   - `packages/core/src/automation_manager/input_parser.ts`

4. **记录操作服务**
   - `packages/room-server/src/fusion/services/fusion.api.service.ts`
   - `packages/core/src/event_manager/helper.ts` (transformOpFields)

5. **前端Schema扩展**
   - `packages/datasheet/src/pc/components/robot/robot_detail/magic_variable_container/helper.ts`


**文档结束**

