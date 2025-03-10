/** @jsxImportSource @emotion/react */
import lodashGet from 'lodash/get';
import { useMemo, memo, CSSProperties } from 'react';
import { ResponsiveChart } from 'react-d3-utils';
import { FaDownload, FaPlus } from 'react-icons/fa';
import { IdcodeSvgRenderer, SmilesSvgRenderer } from 'react-ocl/full';

import { PrepareDataResult } from '../../../data/data1d/database';
import Button from '../../elements/Button';
import { ColumnWrapper } from '../../elements/ColumnWrapper';
import ReactTable from '../../elements/ReactTable/ReactTable';
import addCustomColumn, {
  CustomColumn,
} from '../../elements/ReactTable/utility/addCustomColumn';
import { HighlightEventSource } from '../../highlight';
import { usePanelPreferences } from '../../hooks/usePanelPreferences';
import { formatNumber } from '../../utility/formatNumber';

interface DatabaseTableProps {
  data: any;
  onAdd: (row: any) => void;
  onSave: (row: any) => void;
  totalCount: number;
}

const overFlowStyle: CSSProperties = {
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
};

const databaseTableColumns = (
  databasePreferences,
): Array<CustomColumn<PrepareDataResult> & { showWhen: string }> => [
  {
    showWhen: 'showNames',
    index: 1,
    Header: 'names',
    accessor: (row) => (row.names ? row.names.join(',') : ''),
    enableRowSpan: true,
    style: {
      width: '100px',
      minWidth: '100px',
      maxWidth: '100px',
      ...overFlowStyle,
    },
  },
  {
    showWhen: 'range.show',
    index: 2,
    Header: 'From - To',
    accessor: (row) => {
      const rangeFormat = databasePreferences.range.format;
      return row?.from && row?.to
        ? `${formatNumber(row.from, rangeFormat)} - ${formatNumber(
            row.to,
            rangeFormat,
          )}`
        : '';
    },
    enableRowSpan: true,
  },
  {
    showWhen: 'delta.show',
    index: 3,
    Header: 'δ (ppm)',
    accessor: 'delta',
    Cell: ({ row }) =>
      row.original.delta
        ? formatNumber(row.original.delta, databasePreferences.delta.format)
        : '',
  },

  {
    showWhen: 'showAssignment',
    index: 4,
    Header: 'Assignment',
    accessor: 'assignment',
  },
  {
    showWhen: 'showMultiplicity',
    index: 5,
    Header: 'Multi.',
    accessor: 'multiplicity',
  },

  {
    showWhen: 'coupling.show',
    index: 6,
    Header: 'J (Hz)',
    accessor: (row) => {
      if (!row?.coupling) {
        return '';
      } else {
        return row.coupling
          .split(',')
          .map((value) =>
            formatNumber(value, databasePreferences.coupling.format),
          )
          .join(',');
      }
    },
    style: {
      width: '60px',
      minWidth: '60px',
      ...overFlowStyle,
    },
  },
  {
    showWhen: 'showSolvent',
    index: 7,
    Header: 'Solvent',
    accessor: 'solvent',
    style: {
      width: '80px',
      minWidth: '80px',
      ...overFlowStyle,
    },
  },
  {
    showWhen: 'showSmiles',
    index: 8,
    Header: 'structure',
    accessor: 'index',
    style: { height: 0 },
    enableRowSpan: true,
    Cell({ row }) {
      const { idCode, coordinates } = row.original?.ocl || {};
      const smiles = row.original?.smiles;
      return (
        <ResponsiveChart>
          {({ width, height }) => {
            if (idCode && coordinates) {
              return (
                <IdcodeSvgRenderer
                  height={height}
                  width={width}
                  idcode={idCode}
                  coordinates={coordinates}
                />
              );
            } else if (smiles) {
              return (
                <SmilesSvgRenderer
                  height={height}
                  width={width}
                  smiles={smiles}
                />
              );
            } else {
              return null;
            }
          }}
        </ResponsiveChart>
      );
    },
  },
];

function DatabaseTable({
  data,
  onAdd,
  onSave,
  totalCount,
}: DatabaseTableProps) {
  const databasePreferences = usePanelPreferences('database');

  const initialColumns = useMemo(
    () => [
      {
        index: 10,
        id: 'add-button',
        Header: '',
        style: {
          width: '1%',
          maxWidth: '60px',
          minWidth: '60px',
          padding: 0,
        },
        accessor: 'index',
        enableRowSpan: true,
        Cell: ({ row }) => {
          const { jcampURL } = row.original;
          return (
            <ColumnWrapper
              style={{ display: 'flex', justifyContent: 'space-evenly' }}
            >
              <Button.Done
                style={{ padding: '0.25rem', fontSize: '0.7rem' }}
                fill="outline"
                onClick={() => onAdd(row.original)}
              >
                <FaPlus />
              </Button.Done>
              {databasePreferences?.allowSaveAsNMRium && (
                <Button.Action
                  style={{ padding: '0.25rem', fontSize: '0.7rem' }}
                  fill="outline"
                  onClick={() => onSave(row.original)}
                  disabled={!jcampURL}
                >
                  <FaDownload />
                </Button.Action>
              )}
            </ColumnWrapper>
          );
        },
      },
    ],
    [databasePreferences?.allowSaveAsNMRium, onAdd, onSave],
  );

  const tableColumns = useMemo(() => {
    const columns = [...initialColumns];
    for (const col of databaseTableColumns(databasePreferences)) {
      const { showWhen, ...colParams } = col;
      if (lodashGet(databasePreferences, showWhen, false)) {
        addCustomColumn(columns, colParams);
      }
    }

    return columns.sort((object1, object2) => object1.index - object2.index);
  }, [databasePreferences, initialColumns]);
  return (
    <ReactTable
      data={data}
      columns={tableColumns}
      highlightedSource={HighlightEventSource.DATABASE}
      groupKey="index"
      approxItemHeight={23.5}
      enableVirtualScroll
      totalCount={totalCount}
      disableDefaultRowStyle
    />
  );
}

export default memo(DatabaseTable);
