export const NAMESPACES = [
  "문서",
  "틀",
  "분류",
  "파일",
  "사용자",
  "Percentage",
  "토론",
  "휴지통",
] as const;

export type Namespace = (typeof NAMESPACES)[number];

const DEFAULT_NAMESPACE: Namespace = "문서";
const PREFIXED_NAMESPACES = NAMESPACES.filter((namespace) => namespace !== DEFAULT_NAMESPACE);

export type ParsedTitle = {
  namespace: Namespace;
  title: string;
  fullTitle: string;
};

export function parseFullTitle(segments: string[]): ParsedTitle {
  const decoded = segments.map((segment) => decodeURIComponent(segment)).join("/");
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex > 0) {
    const prefix = decoded.slice(0, separatorIndex);
    const rest = decoded.slice(separatorIndex + 1);
    const namespace = PREFIXED_NAMESPACES.find((candidate) => candidate === prefix);
    if (namespace && rest) {
      return { namespace, title: rest, fullTitle: `${namespace}:${rest}` };
    }
  }

  return { namespace: DEFAULT_NAMESPACE, title: decoded, fullTitle: decoded };
}

export function fullTitleHref(
  base: "/w" | "/edit" | "/history" | "/diff" | "/backlink" | "/move" | "/delete",
  fullTitle: string,
): string {
  const encodedSegments = fullTitle.split("/").map(encodeURIComponent).join("/");
  return `${base}/${encodedSegments}`;
}
