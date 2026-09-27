export function ChartData({ title, columns, rows }: Readonly<{
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
}>) {
  return (
    <details className="chart-data">
      <summary>View chart data</summary>
      {/* tabIndex lets keyboard users scroll this overflow container in Safari. */}
      <section className="chart-data-scroll" aria-label={`${title} data`} tabIndex={0}>
        <table>
          <caption className="sr-only">{title}</caption>
          <thead><tr>{columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
          {/* The first column is each row's label (date, week, repo, referrer) and is unique per chart. */}
          <tbody>{rows.map((row) => <tr key={String(row[0])}>{row.map((value, cell) =>
            cell === 0
              ? <th scope="row" key={columns[cell]}>{value ?? "Unavailable"}</th>
              : <td key={columns[cell]}>{value ?? "Unavailable"}</td>
          )}</tr>)}</tbody>
        </table>
      </section>
    </details>
  );
}
