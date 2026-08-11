import type { IDatabaseChange, IDatabaseSchemaContract } from 'shared';

interface DatabaseSchemaPreviewProps {
  schemaContracts?: IDatabaseSchemaContract[];
  databaseChanges?: IDatabaseChange[];
}

function formatIndex(index: IDatabaseSchemaContract['indexes'][number]): string {
  const fields = Object.entries(index.fields)
    .map(([field, direction]) => `${field}:${direction}`)
    .join(', ');
  return index.unique ? `${fields} (unique)` : fields;
}

/**
 * Real, dynamically-generated database schema preview for a Database Agent generation (Phase 8
 * spec §32/§34/§68/§78) — every field/index/relationship shown here comes straight from the
 * generation's own `schemaContracts`/`databaseChanges`, never hardcoded. Renders as a plain
 * model/field list rather than a React Flow diagram, mirroring how the Planner's own architecture
 * view already handles the "not installed" case (`docs/ARCHITECTURE.md`) — a graph library isn't a
 * dependency of this project, and the structured data here is exactly what a future graph view
 * would consume unchanged.
 */
export function DatabaseSchemaPreview({ schemaContracts, databaseChanges }: DatabaseSchemaPreviewProps) {
  const hasSchemas = Boolean(schemaContracts?.length);
  const hasChanges = Boolean(databaseChanges?.length);

  if (!hasSchemas && !hasChanges) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-card/30 p-2 text-xs">
      <p className="font-medium">Database schema:</p>

      {hasSchemas && (
        <div className="flex flex-col gap-2">
          {schemaContracts!.map((schema) => (
            <div key={schema.model} className="rounded border border-border/40 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">{schema.model}</span>
                <span className="font-mono text-muted-foreground">{schema.collection}</span>
              </div>
              <ul className="flex flex-col gap-0.5 font-mono">
                {Object.entries(schema.fields).map(([name, field]) => (
                  <li key={name}>
                    {name}: {field.type}
                    {field.required ? ' (required)' : ''}
                    {field.unique ? ' (unique)' : ''}
                    {field.ref ? ` → ${field.ref}` : ''}
                  </li>
                ))}
              </ul>
              {schema.indexes.length > 0 && (
                <p className="mt-1">
                  <span className="text-muted-foreground">Indexes: </span>
                  <span className="font-mono">{schema.indexes.map(formatIndex).join('; ')}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {hasChanges && (
        <ul className="flex flex-col gap-0.5">
          {databaseChanges!.map((change, index) => (
            <li key={`${change.type}-${change.model}-${index}`}>
              <span className="font-mono">{change.type}</span> · {change.model}
              {change.reason ? ` — ${change.reason}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
