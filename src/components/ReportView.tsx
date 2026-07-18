import React, { useState, useMemo } from 'react';
import { Transaction, Product } from '../types';
import { BarChart, TrendingUp, TrendingDown, DollarSign, Download, Calendar, Award, FileSpreadsheet, PieChart } from 'lucide-react';

interface ReportViewProps {
  transactions: Transaction[];
  products: Product[];
  addLogMessage: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function ReportView({
  transactions,
  products,
  addLogMessage
}: ReportViewProps) {
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('week');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Group and process data based on selected timeframe
  const reportsData = useMemo(() => {
    // Current local date in Vietnam context is July 6, 2026.
    const today = new Date('2026-07-06');
    
    let filteredTxs = [...transactions];
    let periods: string[] = [];
    let thuMap: { [key: string]: number } = {};
    let chiMap: { [key: string]: number } = {};

    if (timeframe === 'today') {
      // Group by hours or just single day
      filteredTxs = transactions.filter(t => t.date.startsWith('2026-07-06'));
      periods = ['Sáng (6-12h)', 'Trưa (12-15h)', 'Chiều (15-18h)', 'Tối (18-22h)'];
      
      periods.forEach(p => {
        thuMap[p] = 0;
        chiMap[p] = 0;
      });

      filteredTxs.forEach(t => {
        const hour = parseInt(t.date.substring(11, 13)) || 12;
        let period = 'Chiều (15-18h)';
        if (hour < 12) period = 'Sáng (6-12h)';
        else if (hour < 15) period = 'Trưa (12-15h)';
        else if (hour < 18) period = 'Chiều (15-18h)';
        else period = 'Tối (18-22h)';

        if (t.type === 'thu') thuMap[period] += t.amount;
        else chiMap[period] += t.amount;
      });

    } else if (timeframe === 'week') {
      // Group by last 7 days (June 30 - July 6)
      periods = ['30/06', '01/07', '02/07', '03/07', '04/07', '05/07', '06/07'];
      periods.forEach(p => {
        thuMap[p] = 0;
        chiMap[p] = 0;
      });

      transactions.forEach(t => {
        const datePart = t.date.substring(0, 10);
        let key = '';
        if (datePart === '2026-06-30') key = '30/06';
        else if (datePart === '2026-07-01') key = '01/07';
        else if (datePart === '2026-07-02') key = '02/07';
        else if (datePart === '2026-07-03') key = '03/07';
        else if (datePart === '2026-07-04') key = '04/07';
        else if (datePart === '2026-07-05') key = '05/07';
        else if (datePart === '2026-07-06') key = '06/07';

        if (key) {
          if (t.type === 'thu') thuMap[key] += t.amount;
          else chiMap[key] += t.amount;
        }
      });

    } else if (timeframe === 'month') {
      // Group by last 4 weeks of June/July 2026
      periods = ['Tuần 1 (01-07)', 'Tuần 2 (08-14)', 'Tuần 3 (15-21)', 'Tuần 4 (22-28)', 'Tuần 5 (29-06)'];
      periods.forEach(p => {
        thuMap[p] = 0;
        chiMap[p] = 0;
      });

      transactions.forEach(t => {
        const datePart = t.date.substring(0, 10);
        const day = parseInt(datePart.substring(8, 10)) || 1;
        const month = parseInt(datePart.substring(5, 7)) || 7;
        
        let key = 'Tuần 5 (29-06)';
        if (month === 6) {
          if (day <= 7) key = 'Tuần 1 (01-07)';
          else if (day <= 14) key = 'Tuần 2 (08-14)';
          else if (day <= 21) key = 'Tuần 3 (15-21)';
          else if (day <= 28) key = 'Tuần 4 (22-28)';
          else key = 'Tuần 5 (29-06)';
        } else if (month === 7) {
          key = 'Tuần 5 (29-06)';
        }

        if (t.type === 'thu') thuMap[key] += t.amount;
        else chiMap[key] += t.amount;
      });
    }

    // Convert structured datasets for rendering custom charts
    const chartData = periods.map(p => ({
      name: p,
      revenue: thuMap[p],
      expense: chiMap[p],
      profit: thuMap[p] - chiMap[p]
    }));

    // Aggregate totals for KPI banners
    let aggRevenue = 0;
    let aggExpense = 0;
    let cogs = 0; // Cost of Goods Sold (Mì gói, sữa, bia giá sỉ)
    let opex = 0; // Operating Expenses (rent, power, salary)

    // Calculate aggregated math based on chosen timeframe filter
    transactions.forEach(t => {
      const isToday = t.date.startsWith('2026-07-06');
      const isPast7Days = ['2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06'].some(d => t.date.startsWith(d));
      
      // Decide if transaction fits timeframe
      let match = false;
      if (timeframe === 'today' && isToday) match = true;
      if (timeframe === 'week' && isPast7Days) match = true;
      if (timeframe === 'month') match = true; // Show all loaded dataset

      if (match) {
        if (t.type === 'thu') {
          aggRevenue += t.amount;
        } else {
          aggExpense += t.amount;
          if (t.category === 'Nhập kho hàng hóa') {
            cogs += t.amount;
          } else {
            opex += t.amount;
          }
        }
      }
    });

    const grossProfit = aggRevenue - cogs;
    const netProfit = aggRevenue - aggExpense;

    return {
      chartData,
      periods,
      aggRevenue,
      aggExpense,
      cogs,
      opex,
      grossProfit,
      netProfit
    };
  }, [transactions, timeframe]);

  // Export financial report mock (Tải báo cáo tài chính)
  const handleExportReport = (format: 'PDF' | 'EXCEL') => {
    addLogMessage(`[Báo cáo] Đang kết xuất bảng cân đối kế toán & báo cáo tài chính theo định dạng ${format}...`, 'info');
    
    setTimeout(() => {
      addLogMessage(`[Báo cáo] Xuất báo cáo thành công! Tải về tập bốc xếp: BC_TAICHINH_${timeframe.toUpperCase()}_2026.${format === 'PDF' ? 'pdf' : 'xlsx'}`, 'success');
    }, 1500);
  };

  // Top Products calculation
  const topProducts = useMemo(() => {
    // Mocking high-selling grocery products based on initial sales
    return [
      { name: 'Mì ăn liền Hảo Hảo tôm chua cay 75g', sku: 'Noodle-HHAO-TCC', quantity: 180, revenue: 810000, profit: 216000 },
      { name: 'Sữa tươi tiệt trùng Vinamilk ít đường 110ml', sku: 'MILK-VNM-110', quantity: 95, revenue: 712500, profit: 161500 },
      { name: 'Bánh ChocoPie Orion hộp 12 gói 396g', sku: 'CAKE-CHOCO-12', quantity: 15, revenue: 810000, profit: 150000 },
      { name: 'Dầu ăn đậu nành Simply nguyên chất 1L', sku: 'OIL-SIMPLY-1L', quantity: 12, revenue: 696000, profit: 114000 },
      { name: 'Nước ngọt Coca Cola lon 320ml', sku: 'COCA-320', quantity: 45, revenue: 495000, profit: 126000 }
    ];
  }, []);

  // Custom Chart Render calculations
  const maxChartValue = useMemo(() => {
    const vals = reportsData.chartData.flatMap(d => [d.revenue, d.expense]);
    const maxVal = Math.max(...vals, 100000);
    return Math.ceil(maxVal / 50000) * 50000; // Round up for neat grid lines
  }, [reportsData.chartData]);

  return (
    <div id="report-view-container" className="space-y-6">
      
      {/* Top filter layout */}
      <div className="bg-surface-card p-4 border border-border-hairline rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-brand">Báo cáo Phân tích Tài chính & Kế toán</h3>
          <p className="text-xs text-ink-muted">Xem thống kê kinh doanh, doanh thu bán hàng tạp hóa và chi phí vận hành.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector timeline */}
          <div className="flex gap-1 bg-bg-main p-0.5 rounded-lg border border-border-hairline shrink-0">
            {(['today', 'week', 'month'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  timeframe === t
                    ? 'bg-white text-brand border border-border-hairline shadow-xs'
                    : 'text-ink-muted hover:text-brand'
                }`}
              >
                {t === 'today' ? 'Hôm nay (6/7)' : t === 'week' ? 'Tuần này (7 ngày)' : 'Tháng này'}
              </button>
            ))}
          </div>

          {/* Export tools */}
          <div className="flex gap-1">
            <button
              onClick={() => handleExportReport('EXCEL')}
              className="p-2 border border-border-hairline hover:border-emerald-500 hover:bg-emerald-50 text-emerald-600 bg-white rounded-lg transition-colors shrink-0 cursor-pointer shadow-xs"
              title="Xuất bảng đối soát Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleExportReport('PDF')}
              className="p-2 border border-border-hairline hover:border-danger hover:bg-[#FBEAE7]/30 text-danger bg-white rounded-lg transition-colors shrink-0 cursor-pointer shadow-xs"
              title="Tải báo cáo tài chính PDF"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Financial statement summary grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Doanh thu thuần */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-hairline shadow-xs">
          <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">1. Doanh thu thuần</span>
          <span className="text-lg font-black text-brand font-mono-data mt-1 block">
            {reportsData.aggRevenue.toLocaleString()}đ
          </span>
          <p className="text-[10px] text-ink-muted mt-1">Đã bao gồm chiết khấu sàn</p>
        </div>

        {/* Giá vốn hàng bán (COGS) */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-hairline shadow-xs">
          <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">2. Giá vốn (COGS)</span>
          <span className="text-lg font-black text-accent font-mono-data mt-1 block">
            {reportsData.cogs.toLocaleString()}đ
          </span>
          <p className="text-[10px] text-ink-muted mt-1">Hàng hóa nhập kho đối chiếu</p>
        </div>

        {/* Chi phí vận hành (OPEX) */}
        <div className="bg-surface-card p-4 rounded-xl border border-border-hairline shadow-xs">
          <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">3. Chi phí hoạt động</span>
          <span className="text-lg font-black text-danger font-mono-data mt-1 block">
            {reportsData.opex.toLocaleString()}đ
          </span>
          <p className="text-[10px] text-ink-muted mt-1">Mặt bằng, tiền bưu cục, điện nước</p>
        </div>

        {/* Lợi nhuận gộp & ròng */}
        <div className="bg-gradient-to-br from-brand-light/35 to-white p-4 rounded-xl border border-brand/20 shadow-xs">
          <span className="text-[10px] font-bold text-brand uppercase tracking-wider block">4. Lợi nhuận ròng</span>
          <span className="text-lg font-black text-brand font-mono-data mt-1 block">
            {reportsData.netProfit.toLocaleString()}đ
          </span>
          <div className="flex justify-between text-[9px] text-brand/80 mt-1.5 pt-1.5 border-t border-brand/15">
            <span>Biên lợi nhuận:</span>
            <span className="font-bold font-mono-data">
              {reportsData.aggRevenue > 0 ? Math.round((reportsData.netProfit / reportsData.aggRevenue) * 100) : 0}%
            </span>
          </div>
        </div>

      </div>

      {/* CHARTS CONTAINER (Doanh thu & Chi phí Song song) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT: Gorgeous Responsive SVG Bar Chart */}
        <div className="lg:col-span-8 bg-surface-card p-5 border border-border-hairline rounded-2xl shadow-xs flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h4 className="text-xs font-bold text-brand uppercase tracking-wider flex items-center gap-1.5">
              <BarChart className="h-4 w-4 text-brand" />
              Biểu đồ trực quan doanh thu & chi phí ({timeframe === 'today' ? 'Trong ngày' : timeframe === 'week' ? 'Trong tuần' : 'Trong tháng'})
            </h4>
            <div className="flex items-center gap-3 text-[10px] font-semibold text-ink-muted">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-brand"></span> Doanh thu
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-danger"></span> Chi phí
              </span>
            </div>
          </div>

          {/* Core SVG Chart layout */}
          <div className="flex-1 min-h-[260px] relative mt-2">
            
            {/* Legend / Axes lines drawing */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-2 pl-12 pr-4">
              {[0, 1, 2, 3, 4].map((g) => {
                const stepVal = (maxChartValue / 4) * g;
                return (
                  <div key={g} className="w-full flex items-center gap-2">
                    <span className="text-[9px] font-mono-data text-ink-muted w-10 text-right shrink-0">
                      {stepVal >= 1000000 ? `${(stepVal/1000000).toFixed(1)}M` : stepVal >= 1000 ? `${(stepVal/1000).toFixed(0)}k` : stepVal}
                    </span>
                    <div className="flex-1 border-t border-border-hairline"></div>
                  </div>
                );
              })}
            </div>

            {/* Bars drawing container */}
            <div className="absolute inset-0 flex justify-between items-end pb-8 pt-2 pl-16 pr-4 h-full">
              {reportsData.chartData.map((d, index) => {
                // Height calculation as percentages
                const revHeightPercent = Math.min(100, Math.max(2, (d.revenue / maxChartValue) * 100));
                const expHeightPercent = Math.min(100, Math.max(2, (d.expense / maxChartValue) * 100));

                const isHovered = hoveredBarIndex === index;

                return (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-center group relative h-full justify-end max-w-[65px] px-1 animate-in slide-in-from-bottom-2 duration-150"
                    onMouseEnter={() => setHoveredBarIndex(index)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                  >
                    
                    {/* Visual columns bars side-by-side */}
                    <div className="flex items-end gap-1.5 w-full h-full justify-center">
                      {/* Revenue Bar */}
                      <div
                        style={{ height: `${revHeightPercent}%` }}
                        className={`w-4 bg-brand rounded-t-sm transition-all duration-300 ${
                          isHovered ? 'bg-brand/90 shadow-md ring-2 ring-brand/20' : 'opacity-95'
                        }`}
                      ></div>
                      
                      {/* Expense Bar */}
                      <div
                        style={{ height: `${expHeightPercent}%` }}
                        className={`w-4 bg-danger rounded-t-sm transition-all duration-300 ${
                          isHovered ? 'bg-danger/90 shadow-md ring-2 ring-danger/20' : 'opacity-95'
                        }`}
                      ></div>
                    </div>

                    {/* Timeline labels under the chart */}
                    <span className="absolute -bottom-6 text-[9px] font-bold text-ink-muted whitespace-nowrap text-center block w-full truncate">
                      {d.name}
                    </span>

                    {/* Hover dynamic absolute tooltip */}
                    {isHovered && (
                      <div className="absolute bottom-[105%] bg-surface-card text-ink p-2.5 rounded-lg shadow-xl border border-border-hairline text-[10px] z-30 pointer-events-none min-w-[140px] space-y-1 animate-in fade-in duration-100">
                        <span className="font-bold text-brand block border-b border-border-hairline pb-1">{d.name}</span>
                        <div className="flex justify-between gap-2 pt-1 text-brand font-bold">
                          <span>Doanh thu:</span>
                          <span className="font-mono-data">{d.revenue.toLocaleString()}đ</span>
                        </div>
                        <div className="flex justify-between gap-2 text-danger font-bold">
                          <span>Chi phí:</span>
                          <span className="font-mono-data">{d.expense.toLocaleString()}đ</span>
                        </div>
                        <div className="flex justify-between gap-2 text-accent pt-1 border-t border-border-hairline font-bold">
                          <span>Lợi nhuận:</span>
                          <span className="font-mono-data">{d.profit.toLocaleString()}đ</span>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

          </div>

          {/* Growth metrics readout */}
          <div className="mt-8 pt-4 border-t border-border-hairline flex justify-between items-center text-xs text-ink-muted bg-bg-main/50 p-3 rounded-xl">
            <span className="flex items-center gap-1 font-semibold text-brand">
              <TrendingUp className="h-4 w-4 text-brand animate-pulse" />
              Sức mua tạp hóa tăng trưởng ổn định trong tháng này.
            </span>
            <span className="text-[10px] text-ink-muted font-mono-data">Cập nhật: Mới tức thì</span>
          </div>
        </div>

        {/* RIGHT: Top Best Selling Products summary list */}
        <div className="lg:col-span-4 bg-surface-card p-5 border border-border-hairline rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4.5">
              <h4 className="text-xs font-bold text-brand uppercase tracking-wider flex items-center gap-1.5">
                <Award className="h-4 w-4 text-brand" />
                Mặt hàng bán chạy
              </h4>
              <span className="text-[9px] text-ink-muted uppercase font-bold font-mono-data">Tháng {new Date().getMonth() + 1}</span>
            </div>

            <div className="space-y-3">
              {topProducts.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-xl hover:bg-bg-main/50 border border-transparent hover:border-border-hairline transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Rank indicator */}
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                      idx === 0 ? 'bg-accent/15 text-accent border border-accent/20' :
                      idx === 1 ? 'bg-brand-light text-brand border border-brand/20' :
                      idx === 2 ? 'bg-danger-light text-danger border border-danger/20' : 'bg-bg-main text-ink-muted border border-transparent'
                    }`}>
                      {idx + 1}
                    </span>
                    
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-ink block truncate" title={p.name}>
                        {p.name}
                      </span>
                      <span className="text-[9px] text-ink-muted">Đã bán: <strong className="text-brand font-mono-data">{p.quantity}</strong> gói/hộp</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-1.5">
                    <span className="font-mono-data font-bold text-xs text-ink block">
                      {p.revenue.toLocaleString()}đ
                    </span>
                    <span className="text-[8.5px] text-brand font-bold block">
                      + {p.profit.toLocaleString()}đ lời
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 bg-brand-light/25 p-3 rounded-xl border border-brand/10 text-center text-brand">
            <span className="text-[10px] text-brand font-black uppercase tracking-wide block">Gợi ý phân tích</span>
            <p className="text-[10px] text-brand/90 mt-1 leading-relaxed">
              "Mì ăn liền Hảo Hảo" đang có sức mua cao nhất. Cần duy trì tồn kho thực tế tối thiểu trên <strong className="text-brand">50 gói</strong> để tránh gián đoạn đơn Shopee.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
