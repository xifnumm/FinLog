'use client';

import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

type ViewMode = 'month' | 'year' | 'overall';

const COLORS = [
  '#6366f1', '#818cf8', '#22c55e', '#34d399', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316',
];

const TOOLTIP = {
  backgroundColor: '#1a1a32',
  border: '1px solid #30305a',
  borderRadius: '10px',
  color: '#ededf8',
  fontSize: '12px',
  padding: '8px 12px',
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: '#121228', borderColor: '#22223a' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#4e4e6e' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

interface ChartsProps {
  mode: ViewMode;
  monthChartData: { name: string; value: number }[];
  monthBarData: { name: string; dedicated: number; actual: number }[];
  yearLineData: { name: string; received: number; spent: number }[];
  last12BarData: { name: string; spent: number }[];
  cumulativeSavingsData: { name: string; savings: number }[];
}

export default function Charts({
  mode,
  monthChartData,
  monthBarData,
  yearLineData,
  last12BarData,
  cumulativeSavingsData,
}: ChartsProps) {
  const tickStyle = { fontSize: 10, fill: '#4e4e6e' };
  const gridStyle = { strokeDasharray: '3 3', stroke: '#22223a' };

  if (mode === 'month') {
    return (
      <>
        <ChartCard title="Spend by Category">
          {monthChartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color: '#4e4e6e' }}>
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={monthChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={82}
                  innerRadius={52}
                  paddingAngle={2}
                >
                  {monthChartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP}
                  formatter={(v) => [`MVR ${Number(v).toFixed(2)}`, '']}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', color: '#8080a8' }}
                  formatter={(v) => v.length > 14 ? v.slice(0, 14) + '…' : v}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Budget vs Actual">
          {monthBarData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color: '#4e4e6e' }}>
              No budgeted expenses
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthBarData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid {...gridStyle} horizontal={false} />
                <XAxis type="number" tick={tickStyle} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={tickStyle}
                  width={80}
                  tickFormatter={(v) => v.length > 10 ? v.slice(0, 10) + '…' : v}
                />
                <Tooltip contentStyle={TOOLTIP} formatter={(v) => [`MVR ${Number(v).toFixed(2)}`, '']} />
                <Bar dataKey="dedicated" fill="#22223a" radius={[0, 4, 4, 0]} name="Budget" />
                <Bar dataKey="actual" fill="#6366f1" radius={[0, 4, 4, 0]} name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </>
    );
  }

  if (mode === 'year') {
    return (
      <>
        <ChartCard title="Income vs Spending">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={yearLineData}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="name" tick={tickStyle} />
              <YAxis tick={tickStyle} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v) => [`MVR ${Number(v).toFixed(2)}`, '']} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#8080a8' }} />
              <Line type="monotone" dataKey="received" stroke="#22c55e" dot={false} strokeWidth={2} name="Income" />
              <Line type="monotone" dataKey="spent" stroke="#ef4444" dot={false} strokeWidth={2} name="Spent" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Savings">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={yearLineData.map((d) => ({ ...d, savings: d.received - d.spent }))}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="name" tick={tickStyle} />
              <YAxis tick={tickStyle} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v) => [`MVR ${Number(v).toFixed(2)}`, '']} />
              <Area
                type="monotone"
                dataKey="savings"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.12}
                strokeWidth={2}
                name="Savings"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </>
    );
  }

  return (
    <>
      <ChartCard title="Spend Per Month (Last 12)">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={last12BarData}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="name" tick={tickStyle} />
            <YAxis tick={tickStyle} />
            <Tooltip contentStyle={TOOLTIP} formatter={(v) => [`MVR ${Number(v).toFixed(2)}`, '']} />
            <Bar dataKey="spent" fill="#6366f1" radius={[4, 4, 0, 0]} name="Spent" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Cumulative Savings">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={cumulativeSavingsData}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="name" tick={tickStyle} />
            <YAxis tick={tickStyle} />
            <Tooltip contentStyle={TOOLTIP} formatter={(v) => [`MVR ${Number(v).toFixed(2)}`, '']} />
            <Line
              type="monotone"
              dataKey="savings"
              stroke="#34d399"
              dot={false}
              strokeWidth={2}
              name="Cumulative Savings"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}
