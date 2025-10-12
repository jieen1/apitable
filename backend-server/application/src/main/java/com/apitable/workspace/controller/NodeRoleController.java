package com.apitable.workspace.controller;

import com.apitable.core.support.ResponseData;
import com.apitable.shared.component.scanner.annotation.ApiResource;
import com.apitable.shared.component.scanner.annotation.GetResource;
import com.apitable.shared.component.scanner.annotation.PostResource;
import com.apitable.shared.context.SessionContext;
import com.apitable.workspace.ro.AddNodeRoleRo;
import com.apitable.workspace.ro.ModifyNodeRoleRo;
import com.apitable.workspace.ro.RoleControlOpenRo;
import com.apitable.workspace.service.INodeRoleService;
import com.apitable.workspace.vo.NodeCollaboratorsVo;
import com.google.common.collect.Lists;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Workbench - Node Role Api")
@ApiResource(path = "/node")
public class NodeRoleController {
    @Resource
    private INodeRoleService iNodeRoleService;


    /**
     * get node roles.
     */
    @GetResource(path = "/listRole", requiredPermission = false)
    @Operation(summary = "Get node roles")
    @Parameter(name = "nodeId", description = "node id", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.QUERY, example = "nodRTGSy43DJ9")
    public ResponseData<NodeCollaboratorsVo> listRoles(@RequestParam("nodeId") String nodeId) {
        NodeCollaboratorsVo nodeCollaboratorsVo = iNodeRoleService.listRole(nodeId);
        return ResponseData.success(nodeCollaboratorsVo);
    }

    /**
     * disable role extend.
     */
    @PostResource(path = "/disableRoleExtend", requiredPermission = false)
    @Operation(summary = "disable node extend")
    @Parameter(name = "nodeId", description = "node id", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.QUERY, example = "nodRTGSy43DJ9")
    public ResponseData<Void> disableRoleExtend(@RequestParam("nodeId") String nodeId,
                                                @RequestBody RoleControlOpenRo roleControlOpenRo) {
        // TODO 不知道roleControlOpenRo中的字段如何使用
        iNodeRoleService.disableRoleExtend(nodeId);
        return ResponseData.success();
    }

    /**
     * enable role extend.
     */
    @PostResource(path = "/enableRoleExtend", requiredPermission = false)
    @Operation(summary = "enable node extend")
    @Parameter(name = "nodeId", description = "node id", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.QUERY, example = "nodRTGSy43DJ9")
    public ResponseData<Void> enableRoleExtend(@RequestParam("nodeId") String nodeId) {
        iNodeRoleService.enableRoleExtend(nodeId);
        return ResponseData.success();
    }

    /**
     * edit role.
     */
    @PostResource(path = "/editRole", requiredPermission = false)
    @Operation(summary = "edit role")
    public ResponseData<Void> editRole(@RequestBody @Valid ModifyNodeRoleRo modifyNodeRoleRo) {
        Long userId = SessionContext.getUserId();
        iNodeRoleService.updateNodeRole(userId, modifyNodeRoleRo.getNodeId(), modifyNodeRoleRo.getRole(), Lists.newArrayList(modifyNodeRoleRo.getUnitId()));
        return ResponseData.success();
    }

    /**
     * add role.
     */
    @PostResource(path = "/addRole", requiredPermission = false)
    @Operation(summary = "add role")
    public ResponseData<Void> addRole(@RequestBody @Valid AddNodeRoleRo addNodeRoleRo) {
        Long userId = SessionContext.getUserId();
        iNodeRoleService.addNodeRole(userId, addNodeRoleRo.getNodeId(), addNodeRoleRo.getRole(), addNodeRoleRo.getUnitIds());
        return ResponseData.success();
    }
}
