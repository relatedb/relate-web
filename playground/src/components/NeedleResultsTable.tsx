import { useMemo } from 'react';
import { DataGrid } from '@neo4j-ndl/react/data-grid';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  createColumnHelper,
} from '@tanstack/react-table';

import type { CLValue, WireResult } from '../lib/wire';
import { isNode, isPath, isRelationship } from '../lib/wire';

interface Props {
  result: WireResult;
}

type Row = Record<string, CLValue>;

const TABLE_ROW_LIMIT = 1000;

// Rank by type so mixed columns sort stably: null last, then numbers,
// booleans, strings, everything else (compared by its JSON text).
function rank(v: CLValue | undefined): number {
  if (v === null || v === undefined) return 4;
  if (typeof v === 'number') return 0;
  if (typeof v === 'boolean') return 1;
  if (typeof v === 'string') return 2;
  return 3;
}

function compareValues(a: CLValue | undefined, b: CLValue | undefined): number {
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 4) return 0;
  if (ra === 0) return (a as number) - (b as number);
  if (ra === 1) return Number(a) - Number(b);
  const sa = ra === 2 ? (a as string) : JSON.stringify(a);
  const sb = rb === 2 ? (b as string) : JSON.stringify(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

export function NeedleResultsTable({ result }: Props) {
  const columns = useMemo(() => {
    const h = createColumnHelper<Row>();
    return result.columns.map((c) =>
      h.accessor((row) => row[c], {
        id: c,
        header: c,
        sortingFn: (a, b, id) => compareValues(a.getValue(id), b.getValue(id)),
        sortUndefined: false,
        cell: (info) => <ValueCell value={info.getValue() ?? null} />,
      }),
    );
  }, [result.columns]);

  const rows = useMemo(
    () => (result.rows.length > TABLE_ROW_LIMIT ? result.rows.slice(0, TABLE_ROW_LIMIT) : result.rows),
    [result.rows],
  );
  const truncated = result.rows.length > TABLE_ROW_LIMIT;

  const tableInstance = useReactTable({
    data: rows,
    columns,
    defaultColumn: { minSize: 50 },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  if (result.rows.length === 0) {
    return (
      <div className="n-flex n-h-full n-items-center n-justify-center n-text-neutral-text-weak">
        No records returned.
      </div>
    );
  }

  return (
    <div
      className="relate-scroll"
      style={{ height: '100%', width: '100%', overflow: 'auto' }}
    >
      {truncated && (
        <div
          className="n-text-neutral-text-weak"
          style={{ padding: '6px 8px', fontSize: 12 }}
        >
          Showing first {TABLE_ROW_LIMIT.toLocaleString()} of{' '}
          {result.rows.length.toLocaleString()} rows.
        </div>
      )}
      <DataGrid
        tableInstance={tableInstance}
        styling={{ isCompact: true, hasZebraStriping: true, borderStyle: 'horizontal' }}
      />
    </div>
  );
}

function ValueCell({ value }: { value: CLValue }) {
  if (value === null) return <span className="v-null">null</span>;
  if (typeof value === 'boolean') return <span className="v-bool">{String(value)}</span>;
  if (typeof value === 'number') return <span className="v-num">{value}</span>;
  if (typeof value === 'string') return <span className="v-str">{value}</span>;
  if (isNode(value)) {
    return (
      <span className="v-node">
        {value.labels.map((l) => <span key={l} className="chip">:{l}</span>)}
        <code>{shortJson(value.properties)}</code>
      </span>
    );
  }
  if (isRelationship(value)) {
    return (
      <span className="v-rel">
        <span className="chip chip-rel">:{value.type}</span>
        <code>{shortJson(value.properties)}</code>
      </span>
    );
  }
  if (isPath(value)) {
    return (
      <span className="v-path">
        Path ({value.nodes.length} nodes, {value.relationships.length} rels)
      </span>
    );
  }
  return <code>{JSON.stringify(value)}</code>;
}

function shortJson(o: Record<string, CLValue>): string {
  const entries = Object.entries(o);
  if (entries.length === 0) return '{}';
  return '{ ' + entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ') + ' }';
}
