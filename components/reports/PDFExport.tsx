'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format, parse } from 'date-fns';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Courier',
    fontSize: 10,
    color: '#1a1a1a',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Courier-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#555',
    marginBottom: 20,
  },
  table: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 4,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  col1: { width: '25%' },
  col2: { width: '35%' },
  col3: { width: '15%', textAlign: 'right' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '10%', textAlign: 'right' },
  headerText: { fontFamily: 'Courier-Bold', fontSize: 9 },
  cellText: { fontSize: 9 },
  positive: { color: '#166534' },
  negative: { color: '#991b1b' },
  summary: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
});

interface ReportRow {
  category: string;
  expense: string;
  dedicated: number | null;
  actual: number | null;
  delta: number | null;
}

interface Period {
  id: string;
  period: string;
  total_received: number;
  is_locked: boolean;
}

function ReportDocument({ period, rows }: { period: Period; rows: ReportRow[] }) {
  const displayPeriod = format(parse(period.period, 'yyyy-MM', new Date()), 'MMMM yyyy');
  const totalLogged = rows.reduce((s, r) => s + (r.actual ?? 0), 0);
  const remaining = period.total_received - totalLogged;

  const fmt = (n: number) =>
    `MVR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Finlog — {displayPeriod}</Text>
        <Text style={styles.subtitle}>
          Generated {format(new Date(), 'dd MMM yyyy')} · Income: {fmt(period.total_received)}
        </Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <View style={styles.col1}><Text style={styles.headerText}>CATEGORY</Text></View>
            <View style={styles.col2}><Text style={styles.headerText}>EXPENSE</Text></View>
            <View style={styles.col3}><Text style={styles.headerText}>BUDGET</Text></View>
            <View style={styles.col4}><Text style={styles.headerText}>ACTUAL</Text></View>
            <View style={styles.col5}><Text style={styles.headerText}>DELTA</Text></View>
          </View>

          {rows.map((row, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.col1}><Text style={styles.cellText}>{row.category}</Text></View>
              <View style={styles.col2}><Text style={styles.cellText}>{row.expense}</Text></View>
              <View style={styles.col3}>
                <Text style={styles.cellText}>{row.dedicated != null ? fmt(row.dedicated) : '—'}</Text>
              </View>
              <View style={styles.col4}>
                <Text style={styles.cellText}>{row.actual != null ? fmt(row.actual) : '—'}</Text>
              </View>
              <View style={styles.col5}>
                <Text
                  style={[
                    styles.cellText,
                    row.delta != null
                      ? row.delta >= 0
                        ? styles.positive
                        : styles.negative
                      : {},
                  ]}
                >
                  {row.delta != null
                    ? `${row.delta >= 0 ? '+' : ''}${fmt(Math.abs(row.delta))}`
                    : '—'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.headerText}>Total Logged</Text>
            <Text style={styles.cellText}>{fmt(totalLogged)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.headerText}>Remaining</Text>
            <Text style={[styles.cellText, remaining >= 0 ? styles.positive : styles.negative]}>
              {fmt(remaining)}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default function PDFExport({ period, rows }: { period: Period; rows: ReportRow[] }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const blob = await pdf(<ReportDocument period={period} rows={rows} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finlog-${period.period}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[--color-accent] hover:bg-[--color-accent-hover] text-white text-xs transition-colors disabled:opacity-60"
    >
      <Download size={13} />
      {loading ? 'Generating…' : 'PDF'}
    </button>
  );
}
