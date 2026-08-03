export type Permission = "member" | "editable_other_namespace" | "admin";

export type Actor = {
  userId: string | null;
  permissions: Permission[];
};

export type AclAction = "read" | "edit" | "delete" | "move" | "discuss" | "acl";

export type AclDocument = {
  namespace: string;
};

const LOGIN_REQUIRED_ACTIONS: AclAction[] = ["delete", "move"];

// 문서별 acl_rules 테이블 판정은 P4에서 이 함수 안으로 통합한다.
// 지금은 기본 정책만 적용한다: 읽기/편집/토론은 모두 허용(IP 포함),
// 삭제/이동은 로그인 사용자, ACL 변경은 관리자만 허용한다.
export function can(action: AclAction, _document: AclDocument, actor: Actor | null): boolean {
  if (action === "acl") {
    return actor?.permissions.includes("admin") ?? false;
  }

  if (LOGIN_REQUIRED_ACTIONS.includes(action)) {
    return actor?.userId != null;
  }

  return true;
}
