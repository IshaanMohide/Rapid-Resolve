import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { Sun, Moon, ArrowLeft, Radio, Clock, ShieldCheck, Activity } from 'lucide-react';
import InteractiveGlobe from './InteractiveGlobe';

// Core Dataset from Reference System
const REGIONS = [
  { n: "East Region", v: 342e6, q: 32e7, hub: "Shanghai" },
  { n: "South Region", v: 286e6, q: 29e7, hub: "Shenzhen" },
  { n: "North Region", v: 231e6, q: 21e7, hub: "Beijing" },
  { n: "West Region", v: 174e6, q: 195e6, hub: "Chengdu" },
  { n: "Central Region", v: 152e6, q: 14e7, hub: "Wuhan" },
  { n: "Northeast Region", v: 96e6, q: 12e7, hub: "Shenyang" },
  { n: "Northwest Region", v: 78e6, q: 7e7, hub: "Xi'an" }
];

const REGIONAL_CITIES = {
  "East Region": [
    { n: "Shanghai", v: 165e6, q: 15e7, hub: "Shanghai" },
    { n: "Hangzhou", v: 78e6, q: 72e6, hub: "Hangzhou" },
    { n: "Nanjing", v: 54e6, q: 50e6, hub: "Nanjing" },
    { n: "Suzhou", v: 45e6, q: 48e6, hub: "Suzhou" }
  ],
  "South Region": [
    { n: "Shenzhen", v: 148e6, q: 15e7, hub: "Shenzhen" },
    { n: "Guangzhou", v: 82e6, q: 85e6, hub: "Guangzhou" },
    { n: "Hong Kong", v: 56e6, q: 55e6, hub: "Hong Kong" }
  ],
  "North Region": [
    { n: "Beijing", v: 168e6, q: 15e7, hub: "Beijing" },
    { n: "Tianjin", v: 63e6, q: 60e6, hub: "Tianjin" }
  ],
  "West Region": [
    { n: "Chengdu", v: 92e6, q: 10e7, hub: "Chengdu" },
    { n: "Chongqing", v: 54e6, q: 60e6, hub: "Chongqing" },
    { n: "Kunming", v: 28e6, q: 35e6, hub: "Kunming" }
  ],
  "Central Region": [
    { n: "Wuhan", v: 98e6, q: 90e6, hub: "Wuhan" },
    { n: "Changsha", v: 54e6, q: 50e6, hub: "Changsha" }
  ],
  "Northeast Region": [
    { n: "Shenyang", v: 58e6, q: 70e6, hub: "Shenyang" },
    { n: "Harbin", v: 38e6, q: 50e6, hub: "Harbin" }
  ],
  "Northwest Region": [
    { n: "Xi'an", v: 78e6, q: 70e6, hub: "Xi'an" }
  ]
};

const CATEGORY_MIX = [
  { n: "Smart devices", v: 512e6 },
  { n: "Cloud services", v: 344e6 },
  { n: "Industrial modules", v: 268e6 },
  { n: "Accessories", v: 152e6 },
  { n: "Technical services", v: 83e6 }
];

const ROUTES = [
  { from: "Shanghai", to: "Rotterdam", v: 8.42, d: -1.2 },
  { from: "Shenzhen", to: "Los Angeles", v: 7.16, d: 3.4 },
  { from: "Shanghai", to: "New York", v: 6.38, d: 1.1 },
  { from: "Guangzhou", to: "Dubai", v: 4.92, d: 5.2 },
  { from: "Beijing", to: "Frankfurt", v: 4.35, d: -0.6 },
  { from: "Shenzhen", to: "Singapore", v: 3.88, d: 2.8 },
  { from: "Chengdu", to: "Moscow", v: 2.64, d: -4.1, level: "warn" },
  { from: "Hong Kong", to: "London", v: 2.41, d: 0.9 },
  { from: "Xi'an", to: "Amsterdam", v: 1.96, d: 7.3 },
  { from: "Shanghai", to: "Sydney", v: 1.72, d: -2.2 }
];

const HUBS = [
  { city: "Shanghai", v: 96 },
  { city: "Shenzhen", v: 88 },
  { city: "Beijing", v: 74 },
  { city: "Guangzhou", v: 66 },
  { city: "Hong Kong", v: 58 },
  { city: "Singapore", v: 62 },
  { city: "Frankfurt", v: 54 },
  { city: "Rotterdam", v: 51 },
  { city: "New York", v: 70 },
  { city: "Los Angeles", v: 64 },
  { city: "Dubai", v: 47 },
  { city: "Moscow", v: 28, level: "warn" },
  { city: "London", v: 44 },
  { city: "Sydney", v: 31 },
  { city: "Chengdu", v: 36 },
  { city: "Xi'an", v: 24 },
  { city: "Amsterdam", v: 39 }
];

const ALERTS = [
  ["09:42", "West Region attainment at 89.2%, below threshold for 3 months", "a"],
  ["09:31", "Chengdu–Moscow route volume down 4.1%; customs delay", "a"],
  ["09:18", "Northstar Labs receivable $2.4M overdue by 63 days", "a"],
  ["08:56", "Shenzhen store sets annual daily sales record of $842K", "b"],
  ["08:44", "Cloud services gross margin down 2.1pp month over month", "b"],
  ["08:20", "Three Northeast stores have not submitted daily reports", "b"],
  ["07:58", "Industrial module A2 returns reach 4.8%, above threshold", "a"],
  ["07:31", "Group operating cash flow turns positive, up 28.2%", "b"]
];

const TOUR_STEPS = [
  { level: 0, region: null, city: null, hub: "Shanghai" },
  { level: 1, region: "East Region", city: null, hub: "Shanghai" },
  { level: 2, region: "East Region", city: "Shanghai", hub: "Shanghai" },
  { level: 1, region: "South Region", city: null, hub: "Shenzhen" },
  { level: 2, region: "South Region", city: "Shenzhen", hub: "Shenzhen" },
  { level: 1, region: "North Region", city: null, hub: "Beijing" },
  { level: 0, region: null, city: null, hub: "Rotterdam" }
];

const formatVal = (val) => (val / 1e8).toFixed(2);

export default function CommandCenter({
  activeTab = 'command',
  onTabChange = () => {}
}) {
  const stageRef = useRef(null);
  const mixChartRef = useRef(null);
  const turnChartRef = useRef(null);
  const trendChartRef = useRef(null);
  const cashChartRef = useRef(null);
  const chartInstances = useRef({});

  // Navigation & Drilldown State
  const [level, setLevel] = useState(0); // 0: Group, 1: Region, 2: City
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(-1);
  const [selectedHubData, setSelectedHubData] = useState(null);
  const [routeHint, setRouteHint] = useState("Click to locate");

  // Real-time Clock
  const [clockTime, setClockTime] = useState({ t: '', d: '' });
  const [isLive, setIsLive] = useState(true);

  // Auto Tour
  const [tourIdx, setTourIdx] = useState(0);
  const [isTourPaused, setIsTourPaused] = useState(false);

  // Theme State
  const [theme, setTheme] = useState('dark');

  // Toggle Theme
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Synchronize CSS tokens helper
  const getCssVar = useCallback((name) => {
    if (typeof window === 'undefined') return '#49b3ff';
    return getComputedStyle(document.body).getPropertyValue(name).trim() || '#49b3ff';
  }, []);

  // Clock Ticker
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockTime({
        t: now.toTimeString().slice(0, 8),
        d: now.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          weekday: 'short'
        })
      });
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Responsive Auto-Scaler: Scales 1920x1080 stage to fill viewport smoothly
  useEffect(() => {
    const handleResize = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const scale = Math.min(w / 1920, h / 1080);
      const stageW = Math.min(2560, Math.max(1920, w / scale));
      const stageH = Math.min(1600, Math.max(1080, h / scale));

      stage.style.width = `${stageW}px`;
      stage.style.height = `${stageH}px`;
      stage.style.transform = `translate(${(w - stageW * scale) / 2}px, ${(h - stageH * scale) / 2}px) scale(${scale})`;

      // Resize all ECharts instances
      Object.values(chartInstances.current).forEach(inst => inst && inst.resize());
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [theme]);

  // Current ranking items depending on drilldown level
  const currentRankList = useMemo(() => {
    if (level === 1 && selectedRegion && REGIONAL_CITIES[selectedRegion]) {
      return REGIONAL_CITIES[selectedRegion];
    }
    return REGIONS;
  }, [level, selectedRegion]);

  const maxRankVal = useMemo(() => {
    return Math.max(...currentRankList.map(r => r.v), 1);
  }, [currentRankList]);

  // Breadcrumbs Array
  const breadcrumbs = useMemo(() => {
    const crumbs = ['Group'];
    if (selectedRegion) crumbs.push(selectedRegion);
    if (selectedCity) crumbs.push(selectedCity);
    return crumbs;
  }, [selectedRegion, selectedCity]);

  // Handle drilldown on ranking item
  const handleItemClick = (name, hub) => {
    if (level === 0) {
      setLevel(1);
      setSelectedRegion(name);
      setSelectedCity(null);
    } else if (level === 1) {
      setLevel(2);
      setSelectedCity(name);
    }
    if (hub) {
      setSelectedHubData({ city: hub, v: null });
    }
  };

  // Back one level in drilldown
  const handleBackOneLevel = () => {
    if (level === 2) {
      setLevel(1);
      setSelectedCity(null);
    } else {
      setLevel(0);
      setSelectedRegion(null);
      setSelectedCity(null);
    }
  };

  // Auto Tour Timer
  useEffect(() => {
    if (isTourPaused) return;
    const interval = setInterval(() => {
      setTourIdx(prev => {
        const next = (prev + 1) % TOUR_STEPS.length;
        const step = TOUR_STEPS[next];
        setLevel(step.level);
        setSelectedRegion(step.region);
        setSelectedCity(step.city);
        if (step.hub) {
          setSelectedHubData({ city: step.hub, v: null });
        }
        return next;
      });
    }, 9000);
    return () => clearInterval(interval);
  }, [isTourPaused]);

  // Initialize and Update ECharts
  useEffect(() => {
    const isDark = theme === 'dark';
    const textColor = isDark ? '#e8eef7' : '#0e1620';
    const mutedColor = isDark ? '#7d8b9e' : '#566374';
    const lineColor = isDark ? '#1a2534' : '#dbe2ec';
    const lineSoft = isDark ? '#131c28' : '#e9eef5';
    const panelBg = isDark ? '#0b0f16' : '#ffffff';

    const axisCommons = {
      axisLine: { lineStyle: { color: lineColor } },
      axisTick: { show: false },
      axisLabel: { color: mutedColor, fontSize: 11 },
      splitLine: { lineStyle: { color: lineSoft } }
    };

    // 1. Category Mix (Donut Chart)
    if (mixChartRef.current) {
      if (!chartInstances.current.mix) {
        chartInstances.current.mix = echarts.init(mixChartRef.current);
      }
      chartInstances.current.mix.setOption({
        animation: false,
        tooltip: { trigger: 'item', backgroundColor: panelBg, borderColor: lineColor, textStyle: { color: textColor } },
        series: [{
          type: 'pie',
          radius: ['42%', '64%'],
          center: ['50%', '52%'],
          itemStyle: { borderColor: panelBg, borderWidth: 3 },
          color: ['#49b3ff', '#7c9dff', '#3fd0a4', '#ffb547', '#38d6d0'],
          label: {
            color: textColor,
            fontSize: 11.5,
            formatter: '{b}\n{d}%',
            lineHeight: 15,
            alignTo: 'edge',
            edgeDistance: 6
          },
          labelLine: { lineStyle: { color: lineColor } },
          data: CATEGORY_MIX.map(c => ({ name: c.n, value: c.v }))
        }]
      }, true);
    }

    // 2. Inventory Turns (Horizontal Bar Chart)
    if (turnChartRef.current) {
      if (!chartInstances.current.turn) {
        chartInstances.current.turn = echarts.init(turnChartRef.current);
      }
      const top5 = REGIONS.slice(0, 5);
      chartInstances.current.turn.setOption({
        animation: false,
        grid: { left: 10, right: 36, top: 10, bottom: 10, containLabel: true },
        xAxis: { type: 'value', ...axisCommons, axisLabel: { show: false }, splitLine: { show: false } },
        yAxis: {
          type: 'category',
          data: top5.map(t => t.n.replace(" Region", "")).reverse(),
          ...axisCommons,
          splitLine: { show: false },
          axisLabel: { color: textColor, fontSize: 12 }
        },
        series: [{
          type: 'bar',
          barWidth: 10,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#49b3ff' },
              { offset: 1, color: '#38d6d0' }
            ])
          },
          label: { show: true, position: 'right', color: mutedColor, fontSize: 11, formatter: '{c}d' },
          data: [42, 38, 46, 51, 35].reverse()
        }]
      }, true);
    }

    // 3. Revenue Trend and Target (Multi-Line Area Chart)
    if (trendChartRef.current) {
      if (!chartInstances.current.trend) {
        chartInstances.current.trend = echarts.init(trendChartRef.current);
      }
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const actual = [2.4, 2.7, 3.1, 3.0, 3.4, 3.8, 3.6, 4.1, null, null, null, null];
      const target = [2.5, 2.6, 2.9, 3.1, 3.3, 3.5, 3.7, 3.9, 4.1, 4.3, 4.5, 4.8];
      const forecast = [null, null, null, null, null, null, null, 4.1, 4.4, 4.6, 4.9, 5.2];

      chartInstances.current.trend.setOption({
        animation: false,
        tooltip: { trigger: 'axis', backgroundColor: panelBg, borderColor: lineColor, textStyle: { color: textColor } },
        legend: {
          top: 4,
          right: 14,
          itemWidth: 14,
          itemHeight: 4,
          textStyle: { color: mutedColor, fontSize: 11.5 }
        },
        grid: { left: 42, right: 18, top: 32, bottom: 24 },
        xAxis: { type: 'category', data: months, ...axisCommons, splitLine: { show: false } },
        yAxis: { type: 'value', name: '$100M', nameTextStyle: { color: mutedColor, fontSize: 11 }, ...axisCommons },
        series: [
          {
            name: 'Actual',
            type: 'line',
            data: actual,
            smooth: true,
            lineStyle: { width: 2.8, color: '#49b3ff' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(73, 179, 255, 0.3)' },
                { offset: 1, color: 'rgba(73, 179, 255, 0)' }
              ])
            }
          },
          {
            name: 'Target',
            type: 'line',
            data: target,
            smooth: true,
            lineStyle: { width: 2, color: '#7c9dff', type: 'dashed' }
          },
          {
            name: 'Forecast',
            type: 'line',
            data: forecast,
            smooth: true,
            lineStyle: { width: 2.2, color: '#3fd0a4', type: 'dotted' }
          }
        ]
      }, true);
    }

    // 4. Collections and Cash Flow (Dual Bar & Line Chart)
    if (cashChartRef.current) {
      if (!chartInstances.current.cash) {
        chartInstances.current.cash = echarts.init(cashChartRef.current);
      }
      const months6 = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
      chartInstances.current.cash.setOption({
        animation: false,
        tooltip: { trigger: 'axis', backgroundColor: panelBg, borderColor: lineColor, textStyle: { color: textColor } },
        legend: {
          top: 2,
          right: 2,
          itemWidth: 12,
          itemHeight: 4,
          textStyle: { color: mutedColor, fontSize: 11 }
        },
        grid: { left: 44, right: 16, top: 30, bottom: 24 },
        xAxis: { type: 'category', data: months6, ...axisCommons, splitLine: { show: false } },
        yAxis: { type: 'value', name: '$10M', nameTextStyle: { color: mutedColor, fontSize: 11 }, ...axisCommons },
        series: [
          {
            name: 'Receivable',
            type: 'bar',
            data: [32, 40, 36, 48, 52, 59],
            barWidth: 9,
            itemStyle: { borderRadius: [3, 3, 0, 0], color: '#7c9dff' }
          },
          {
            name: 'Collected',
            type: 'bar',
            data: [28, 36, 33, 44, 49, 56],
            barWidth: 9,
            itemStyle: { borderRadius: [3, 3, 0, 0], color: '#3fd0a4' }
          },
          {
            name: 'Cash Flow',
            type: 'line',
            data: [14, 18, 16, 24, 28, 34],
            smooth: true,
            lineStyle: { width: 2.2, color: '#ffb547' }
          }
        ]
      }, true);
    }
  }, [theme, level, selectedRegion]);

  // 5 Top KPI Widgets
  const kpiList = useMemo(() => [
    { l: "Annual revenue", v: "13.61", u: "$100M", d: 12.6, good: true },
    { l: "Target attainment", v: "102.3", u: "%", d: 2.4, good: true },
    { l: "Gross margin", v: "34.8", u: "%", d: 1.2, good: true },
    { l: "Collection rate", v: "86.3", u: "%", d: -1.8, good: false },
    { l: "Inventory turns", v: "41.2", u: "days", d: -3.6, good: true }
  ], []);

  // Hub Selection Callback from Globe
  const handleSelectHub = (city, throughput) => {
    setSelectedHubData({ city, v: throughput || 64 });
    const rIdx = ROUTES.findIndex(r => r.from === city || r.to === city);
    if (rIdx >= 0) setSelectedRouteIdx(rIdx);
    setRouteHint(`${city} focused`);
  };

  return (
    <div className="command-viewport">
      <div id="stage" ref={stageRef}>
        {/* Top Header Bar */}
        <div className="top">
          <div className="title">
            GLOBAL OPERATIONS COMMAND CENTER
            <small>LIVE GROUP PERFORMANCE · RAPID RESOLVE SYSTEM</small>
          </div>

          {/* Interactive Drilldown Breadcrumb */}
          <div className="crumb">
            {level > 0 && (
              <button onClick={handleBackOneLevel}>
                <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Back
              </button>
            )}
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb}>
                {idx > 0 && <span>›</span>}
                <span className={idx === breadcrumbs.length - 1 ? "cur" : ""}>{crumb}</span>
              </React.Fragment>
            ))}
          </div>

          {/* Rapid Resolve App Navigation Switcher */}
          <div className="nav-tabs-bar ml-4">
            <button
              className={`nav-tab-btn ${activeTab === 'command' ? 'active' : ''}`}
              onClick={() => onTabChange('command')}
            >
              Command Deck
            </button>
            <button
              className={`nav-tab-btn ${activeTab === 'citizen' ? 'active' : ''}`}
              onClick={() => onTabChange('citizen')}
            >
              Citizen AI Desk
            </button>
            <button
              className={`nav-tab-btn ${activeTab === 'track' ? 'active' : ''}`}
              onClick={() => onTabChange('track')}
            >
              Track Complaint
            </button>
          </div>

          <div className="spacer" />

          {/* Live Pulsing Beacon */}
          <div className={`live ${isLive ? '' : 'off'}`}>
            <span className="blip" />
            <span>{isLive ? 'LIVE' : 'DISCONNECTED'}</span>
          </div>

          {/* Real-time Precision Digital Clock */}
          <div className="clock">
            <span>{clockTime.t || '12:00:00'}</span>
            <small>{clockTime.d || 'UTC 2026'}</small>
          </div>
        </div>

        {/* Main 3-Column Deck Layout */}
        <div className="body">
          {/* Left Column */}
          <div className="col">
            {/* Card 1: Regional Attainment */}
            <div className="card">
              <h2>
                Regional attainment
                <span className="r">
                  {level === 0 ? 'Click to drill into cities' : 'District stores'}
                </span>
              </h2>
              <div className="rank">
                {currentRankList.map((item, idx) => {
                  const pct = Math.round((item.v / item.q) * 100);
                  const isSel = selectedRegion === item.n || selectedCity === item.n;
                  return (
                    <div
                      key={item.n}
                      className={`rk ${isSel ? 'sel' : ''}`}
                      onClick={() => handleItemClick(item.n, item.hub)}
                    >
                      <div className={`no ${idx < 3 ? 't3' : ''}`}>{idx + 1}</div>
                      <div className="nm">{item.n}</div>
                      <div className="track">
                        <div
                          className="fill"
                          style={{ width: `${Math.min(100, (item.v / maxRankVal) * 100)}%` }}
                        />
                      </div>
                      <div className="v">${formatVal(item.v)}00M</div>
                      <div
                        className="p"
                        style={{
                          color: pct >= 100 ? 'var(--c3)' : pct >= 90 ? 'var(--c4)' : 'var(--c5)'
                        }}
                      >
                        {pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 2: Category Mix */}
            <div className="card">
              <h2>Category mix</h2>
              <div className="chart" ref={mixChartRef} />
            </div>

            {/* Card 3: Inventory Turns */}
            <div className="card">
              <h2>
                Inventory turns
                <span className="r">days</span>
              </h2>
              <div className="chart" ref={turnChartRef} />
            </div>
          </div>

          {/* Mid Column */}
          <div className="mid">
            {/* 5-Card KPI Bar */}
            <div className="kpibar">
              {kpiList.map((kpi) => {
                const isPos = kpi.d >= 0;
                const isGood = kpi.good ? isPos : !isPos;
                return (
                  <div className="kpi" key={kpi.l}>
                    <div className="l">{kpi.l}</div>
                    <div className="v">
                      {kpi.v}<u>{kpi.u}</u>
                    </div>
                    <div className={`d ${isGood ? 'up' : 'down'}`}>
                      {isPos ? '▲' : '▼'} {Math.abs(kpi.d)}%
                      <span>YoY</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3D Earth Globe Stage */}
            <div className="globe">
              <InteractiveGlobe
                markers={HUBS}
                routes={ROUTES}
                selectedHub={selectedHubData?.city}
                onSelectHub={handleSelectHub}
                isAutoTour={!isTourPaused}
              />

              {/* Futuristic HUD Corner Crosshairs */}
              <div className="hud">
                <i /><i /><i /><i />
              </div>

              {/* HUD Header Title */}
              <div className="gtitle">
                <b>GLOBAL TRADE NETWORK</b>
                <small>ROUTES · HUBS · REALTIME</small>
              </div>

              {/* Status Readout Panel */}
              <div className="readout">
                {selectedHubData ? (
                  <>
                    <span>Selected hub</span>
                    <b>{selectedHubData.city}</b>
                    <span className="k">Throughput {selectedHubData.v || '78'}</span>
                  </>
                ) : (
                  <>
                    <span>Hubs</span>
                    <b>{HUBS.length}</b>
                    <span>· Routes</span>
                    <b>{ROUTES.length}</b>
                    <span className="k">
                      In transit ${ROUTES.reduce((acc, cur) => acc + cur.v, 0).toFixed(1)}B
                    </span>
                  </>
                )}
              </div>

              <div className="ghint">
                Drag to rotate · click a hub to drill down
              </div>
            </div>

            {/* Bottom Card: Revenue Trend & Target */}
            <div className="card">
              <h2>
                Revenue trend and target
                <span className="r">
                  {selectedCity || selectedRegion || 'Group'}
                </span>
              </h2>
              <div className="chart" ref={trendChartRef} />
            </div>
          </div>

          {/* Right Column */}
          <div className="col">
            {/* Card 1: Cross-border Routes */}
            <div className="card">
              <h2>
                Cross-border routes
                <span className="r">{routeHint}</span>
              </h2>
              <div className="routes">
                {ROUTES.map((route, idx) => (
                  <div
                    key={`${route.from}-${route.to}`}
                    className={`rt ${idx === selectedRouteIdx ? 'sel' : ''}`}
                    onClick={() => {
                      setSelectedRouteIdx(idx);
                      setSelectedHubData({ city: route.from, v: null });
                      setRouteHint(`${route.from} → ${route.to}`);
                    }}
                  >
                    <span className="pair">
                      {route.from}<em>→</em>{route.to}
                    </span>
                    <span
                      className="amt"
                      style={{ color: route.level === 'warn' ? 'var(--c4)' : 'var(--ink)' }}
                    >
                      {route.v.toFixed(2)}
                    </span>
                    <span
                      className="dl"
                      style={{ color: route.d >= 0 ? 'var(--c3)' : 'var(--c5)' }}
                    >
                      {route.d >= 0 ? '+' : ''}{route.d}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 2: Live Alerts */}
            <div className="card">
              <h2>
                Live alerts
                <span className="r">
                  {ALERTS.filter(a => a[2] === 'a').length} critical
                </span>
              </h2>
              <div className="alerts">
                <div className="lane">
                  {ALERTS.concat(ALERTS).map(([time, desc, severity], idx) => (
                    <div
                      key={idx}
                      className={`al ${severity === 'a' ? 'hi' : ''}`}
                    >
                      <span className="t">{time}</span>
                      <span className="x">{desc}</span>
                      <span className={`lv ${severity}`}>
                        {severity === 'a' ? 'HIGH' : 'MED'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 3: Collections and Cash Flow */}
            <div className="card">
              <h2>Collections and cash flow</h2>
              <div className="chart" ref={cashChartRef} />
            </div>
          </div>
        </div>

        {/* Bottom Tour Dots Indicator */}
        <div className="dots">
          <span
            className="cursor-pointer hover:text-white"
            onClick={() => setIsTourPaused(p => !p)}
          >
            {isTourPaused ? 'TOUR PAUSED' : 'AUTO TOUR'}
          </span>
          {TOUR_STEPS.map((_, idx) => (
            <i key={idx} className={idx === tourIdx ? 'on' : ''} />
          ))}
        </div>
      </div>

      {/* Floating Theme Toggle Button */}
      <button
        className="kit-theme-float"
        onClick={toggleTheme}
        title="Toggle Dark / Light Mode"
        aria-label="Toggle Theme"
      >
        {theme === 'dark' ? <Sun /> : <Moon />}
      </button>
    </div>
  );
}
