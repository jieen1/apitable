package com.apitable.datasheet.controller;

import com.apitable.control.infrastructure.ControlIdBuilder;
import com.apitable.control.service.IControlService;
import com.apitable.core.support.ResponseData;
import com.apitable.organization.service.IMemberService;
import com.apitable.shared.component.scanner.annotation.ApiResource;
import com.apitable.shared.component.scanner.annotation.GetResource;
import com.apitable.shared.component.scanner.annotation.PostResource;
import com.apitable.shared.context.SessionContext;
import com.apitable.shared.util.page.PageInfo;
import com.apitable.shared.util.page.PageObjectParam;
import com.apitable.shared.validator.NodeMatch;
import com.apitable.workspace.ro.FieldRoleCreateRo;
import com.apitable.workspace.ro.FieldRoleEditRo;
import com.apitable.workspace.ro.RoleControlOpenRo;
import com.apitable.workspace.service.IFieldRoleService;
import com.apitable.workspace.service.INodeService;
import com.apitable.workspace.service.INodeShareSettingService;
import com.apitable.workspace.vo.FieldCollaboratorVO;
import com.apitable.workspace.vo.FieldPermissionView;
import com.apitable.workspace.vo.FieldRoleMemberVo;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.google.common.collect.Lists;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

import static com.apitable.shared.constants.PageConstants.PAGE_PARAM;
import static com.apitable.shared.constants.PageConstants.PAGE_SIMPLE_EXAMPLE;

@RestController
@ApiResource(path = "/datasheet")
@Tag(name = "Datasheet")
public class DataSheetController {

    @Resource
    private IMemberService iMemberService;

    @Resource
    private IControlService iControlService;

    @Resource
    private IFieldRoleService iFieldRoleService;

    @Resource
    private INodeService iNodeService;

    @Resource
    private INodeShareSettingService iNodeShareSettingService;

    @GetResource(path = "/{dstId}/field/{fieldId}/listRole", requiredPermission = false)
    @Operation(summary = "list Role of Field Permissions")
    @Parameters({
            @Parameter(name = "dstId", description = "table id", required = true,
                    schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "dstGxznHFXf9pvF1LZ"),
            @Parameter(name = "fieldId", description = "field id", required = true,
                    schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "fldB7uWmwYrQf")
    })
    public ResponseData<FieldCollaboratorVO> listRole(@PathVariable("dstId") @NodeMatch String dstId,
                                                      @PathVariable("fieldId") String fieldId) {
        FieldCollaboratorVO fieldRoles = iFieldRoleService.getFieldRoles(dstId, fieldId);
        return ResponseData.success(fieldRoles);
    }

    @GetResource(path = "/{dstId}/field/{fieldId}/collaborator/page", requiredPermission = false)
    @Operation(summary = "list collaborator paged")
    @Parameters({
            @Parameter(name = "dstId", description = "table id", required = true,
                    schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "dstGxznHFXf9pvF1LZ"),
            @Parameter(name = "fieldId", description = "field id", required = true,
                    schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "fldB7uWmwYrQf"),
            @Parameter(name = PAGE_PARAM, in = ParameterIn.QUERY, description = "page",
                    schema = @Schema(type = "string"), example = PAGE_SIMPLE_EXAMPLE)
    })
    public ResponseData<PageInfo<FieldRoleMemberVo>> collaboratorPage(@PathVariable("dstId") @NodeMatch String dstId,
                                                    @PathVariable("fieldId") String fieldId,
                                                    @PageObjectParam(required = false) Page<FieldRoleMemberVo> page) {
        PageInfo<FieldRoleMemberVo> fieldRoleMembersPageInfo = iFieldRoleService.getFieldRoleMembersPageInfo(page, dstId, fieldId);
        return ResponseData.success(fieldRoleMembersPageInfo);
    }

    @PostResource(path = "/{dstId}/field/{fieldId}/permission/enable", requiredPermission = false)
    @Operation(summary = "enable filed permission")
    @Parameters({
            @Parameter(name = "dstId", description = "table id", required = true,
                    schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "dstGxznHFXf9pvF1LZ"),
            @Parameter(name = "fieldId", description = "field id", required = true,
                    schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "fldB7uWmwYrQf")
    })
    public ResponseData<Void> enableFiledPermission(@PathVariable("dstId") @NodeMatch String dstId,
                                                              @PathVariable("fieldId") String fieldId,
                                                              @RequestBody RoleControlOpenRo roleControlOpenRo) {
        Long userId = SessionContext.getUserId();
        iFieldRoleService.enableFieldRole(userId, dstId, fieldId, Boolean.TRUE.equals(roleControlOpenRo.getIncludeExtend()));
        return ResponseData.success();
    }

    @GetResource(path = "/field/permission", requiredPermission = false)
    @Operation(summary = "list collaborator paged")
    @Parameters({
            @Parameter(name = "dstIds", description = "table ids", required = true,
                    schema = @Schema(type = "string"), in = ParameterIn.QUERY, example = "dstGxznHFXf9pvF1LZ,")
    })
    public ResponseData<List<FieldPermissionView>> fieldPermissionViews(@RequestParam("dstIds")  List<String> dstIds) {
        Long userId = SessionContext.getUserId();
        String nodeSpaceId =
                iNodeService.checkNodeIfExist(null, dstIds.get(0));
        Long memberId = iMemberService.getMemberIdByUserIdAndSpaceId(userId, nodeSpaceId);

        List<FieldPermissionView> result = new ArrayList<>();
        for (String dstId: dstIds) {
            FieldPermissionView view =
                    iFieldRoleService.getFieldPermissionView(memberId, dstId, null);
            if (view != null) {
                result.add(view);
            }
        }

        return ResponseData.success(result);
    }

    @PostResource(path = "/{dstId}/field/{fieldId}/editRole", requiredPermission = false)
    @Operation(summary = "editRole filed permission")
    @Parameters({
            @Parameter(name = "dstId", description = "table id", required = true,
                    schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "dstGxznHFXf9pvF1LZ"),
            @Parameter(name = "fieldId", description = "field id", required = true,
                    schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "fldB7uWmwYrQf")
    })
    public ResponseData<Void> editRole(@PathVariable("dstId") @NodeMatch String dstId,
                                                    @PathVariable("fieldId") String fieldId,
                                                    @RequestBody FieldRoleEditRo fieldRoleEditRo) {
        Long userId = SessionContext.getUserId();
        ControlIdBuilder.ControlId controlId = ControlIdBuilder.fieldId(dstId, fieldId);
        iFieldRoleService.editFieldRole(userId, controlId.toString(), Lists.newArrayList(fieldRoleEditRo.getUnitId()), fieldRoleEditRo.getRole());
        return ResponseData.success();
    }


    @PostResource(path = "/{dstId}/field/{fieldId}/addRole", requiredPermission = false)
    @Operation(summary = "addRole filed permission")
    @Parameters({
            @Parameter(name = "dstId", description = "table id", required = true,
                    schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "dstGxznHFXf9pvF1LZ"),
            @Parameter(name = "fieldId", description = "field id", required = true,
                    schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "fldB7uWmwYrQf")
    })
    public ResponseData<Void> addRole(@PathVariable("dstId") @NodeMatch String dstId,
                                       @PathVariable("fieldId") String fieldId,
                                       @RequestBody FieldRoleCreateRo fieldRoleCreateRo) {
        Long userId = SessionContext.getUserId();
        ControlIdBuilder.ControlId controlId = ControlIdBuilder.fieldId(dstId, fieldId);
        iFieldRoleService.addFieldRole(userId, controlId.toString(), fieldRoleCreateRo.getUnitIds(), fieldRoleCreateRo.getRole());
        return ResponseData.success();
    }

}
