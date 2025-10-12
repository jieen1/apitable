package com.apitable.workspace.controller;

import com.apitable.core.support.ResponseData;
import com.apitable.shared.component.scanner.annotation.ApiResource;
import com.apitable.shared.component.scanner.annotation.GetResource;
import com.apitable.workspace.service.INodeRoleService;
import com.apitable.workspace.vo.NodeCollaboratorsVo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.Resource;
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
}
