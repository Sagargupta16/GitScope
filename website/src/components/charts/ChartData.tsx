export function ChartData({ title, columns, rows }: {
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
}) {
  return (
    <details className="chart-data">
      <summary>View chart data</summary>
      <div className="chart-data-scroll" role="region" aria-label={`${title} data`} tabIndex={0}>
        <table>
          <caption className="sr-only">{title}</caption>
          <thead><tr>{columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index}>{row.map((value, cell) =>
            cell === 0 ? <th scope="row" key={cell}>{value ?? "Unavailable"}</th> : <td key={cell}>{value ?? "Unavailable"}</td>
          )}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}
