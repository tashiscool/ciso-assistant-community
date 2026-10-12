import type { FrameworkTreeNode } from './types';

export function countAssessableNodes(nodes: FrameworkTreeNode[]): number {
  return nodes.reduce((count, node) => {
    const childCount = countAssessableNodes(node.children);
    return count + childCount + (node.assessable ? 1 : 0);
  }, 0);
}

export function FrameworkTree({
  nodes,
  depth = 0,
}: {
  nodes: FrameworkTreeNode[];
  depth?: number;
}) {
  return (
    <div className="space-y-3">
      {nodes.map((node) => (
        <div
          key={node.id}
          className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4"
          style={{ marginLeft: depth === 0 ? 0 : `${depth * 14}px` }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-[#6d28d9]">
              {node.ref}
            </span>
            <span className="text-sm font-medium text-[#241232]">{node.title}</span>
            <span className={node.assessable ? 'status-pill-success' : 'status-pill-neutral'}>
              {node.assessable ? 'Assessable' : 'Section'}
            </span>
          </div>
          {node.description && <p className="mt-2 text-sm leading-6 text-[#4f435c]">{node.description}</p>}
          {node.children.length > 0 && (
            <div className="mt-4 border-l border-[#ded8e4] pl-3">
              <FrameworkTree depth={depth + 1} nodes={node.children} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
