/* ===== NYC Airbnb Dashboard — App Logic ===== */

// Chart.js global defaults
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.display = false;
Chart.defaults.animation.duration = 600;
Chart.defaults.animation.easing = 'easeOutQuart';

// Color palette
const COLORS = {
    boroughs: {
        'Manhattan': '#6366f1',
        'Brooklyn': '#06b6d4',
        'Queens': '#10b981',
        'Bronx': '#f59e0b',
        'Staten Island': '#f43f5e'
    },
    rooms: {
        'Entire home/apt': '#6366f1',
        'Private room': '#06b6d4',
        'Shared room': '#f59e0b',
        'Hotel room': '#f43f5e'
    },
    gradient: ['#6366f1', '#818cf8', '#a5b4fc']
};

// State
let DATA = null;
let map = null;
let mapMarkers = null;
let charts = {};

/* ===== Load Data & Init ===== */
fetch('dashboard_data.json')
    .then(r => r.json())
    .then(data => {
        DATA = data;
        initFilters();
        renderAll();
        // Hide loader, show dashboard
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('dashboard').classList.add('visible');
        setTimeout(() => document.getElementById('loading').remove(), 500);
    })
    .catch(err => {
        console.error('Failed to load data:', err);
        document.querySelector('.loading-overlay p').textContent =
            'Error loading data. Make sure dashboard_data.json exists.';
    });

/* ===== Filters ===== */
function initFilters() {
    const boroughSel = document.getElementById('filter-borough');
    const roomSel = document.getElementById('filter-room');
    const cancelSel = document.getElementById('filter-cancel');

    DATA.boroughs.forEach(b => {
        boroughSel.innerHTML += `<option value="${b}">${b}</option>`;
    });
    DATA.room_type_list.forEach(r => {
        roomSel.innerHTML += `<option value="${r}">${r}</option>`;
    });
    DATA.cancellation_list.forEach(c => {
        cancelSel.innerHTML += `<option value="${c}">${c[0].toUpperCase() + c.slice(1)}</option>`;
    });

    [boroughSel, roomSel, cancelSel].forEach(el =>
        el.addEventListener('change', () => renderAll())
    );
    document.getElementById('reset-filters').addEventListener('click', () => {
        boroughSel.value = 'all';
        roomSel.value = 'all';
        cancelSel.value = 'all';
        renderAll();
    });
}

function getFilters() {
    return {
        borough: document.getElementById('filter-borough').value,
        room: document.getElementById('filter-room').value,
        cancel: document.getElementById('filter-cancel').value
    };
}

function filterRaw() {
    const f = getFilters();
    const bi = f.borough !== 'all' ? DATA.boroughs.indexOf(f.borough) : -1;
    const ri = f.room !== 'all' ? DATA.room_type_list.indexOf(f.room) : -1;
    const ci = f.cancel !== 'all' ? DATA.cancellation_list.indexOf(f.cancel) : -1;

    return DATA.raw.filter(r => {
        if (bi >= 0 && r[0] !== bi) return false;
        if (ri >= 0 && r[1] !== ri) return false;
        if (ci >= 0 && r[2] !== ci) return false;
        return true;
    });
}

/* ===== Render All ===== */
function renderAll() {
    const rows = filterRaw();
    renderKPIs(rows);
    renderPriceByBorough(rows);
    renderRoomTypes(rows);
    renderGrowth(rows);
    renderRatings(rows);
    renderMap();
}

/* ===== KPIs ===== */
function renderKPIs(rows) {
    const n = rows.length;
    const avgPrice = n ? rows.reduce((s, r) => s + r[3], 0) / n : 0;
    const avgAvail = n ? rows.reduce((s, r) => s + r[4], 0) / n : 0;
    const estRev = rows.reduce((s, r) => s + r[3] * (365 - r[4]), 0);

    animateValue('kpi-val-listings', n.toLocaleString());
    animateValue('kpi-val-price', '$' + Math.round(avgPrice).toLocaleString());
    animateValue('kpi-val-avail', Math.round(avgAvail).toLocaleString());
    animateValue('kpi-val-revenue', '$' + formatBigNumber(estRev));
}

function animateValue(id, value) {
    const el = document.getElementById(id);
    el.style.opacity = 0;
    el.style.transform = 'translateY(6px)';
    setTimeout(() => {
        el.textContent = value;
        el.style.transition = 'opacity 0.3s, transform 0.3s';
        el.style.opacity = 1;
        el.style.transform = 'translateY(0)';
    }, 80);
}

function formatBigNumber(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
}

/* ===== Chart: Price by Borough ===== */
function renderPriceByBorough(rows) {
    const agg = {};
    rows.forEach(r => {
        const b = DATA.boroughs[r[0]];
        if (!agg[b]) agg[b] = { sum: 0, count: 0 };
        agg[b].sum += r[3];
        agg[b].count++;
    });

    const sorted = Object.entries(agg)
        .map(([b, v]) => ({ borough: b, avg: v.sum / v.count }))
        .sort((a, b) => b.avg - a.avg);

    const labels = sorted.map(d => d.borough);
    const values = sorted.map(d => Math.round(d.avg));
    const colors = labels.map(l => COLORS.boroughs[l] || '#6366f1');

    if (charts.price) charts.price.destroy();
    charts.price = new Chart(document.getElementById('chart-price'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors.map(c => c + '40'),
                borderColor: colors,
                borderWidth: 2,
                borderRadius: 8,
                barPercentage: 0.65
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { callback: v => '$' + v }
                },
                y: { grid: { display: false } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: ctx => ' $' + ctx.parsed.x.toLocaleString()
                    }
                }
            }
        }
    });
}

/* ===== Chart: Room Types (Doughnut) ===== */
function renderRoomTypes(rows) {
    const agg = {};
    rows.forEach(r => {
        const t = DATA.room_type_list[r[1]];
        agg[t] = (agg[t] || 0) + 1;
    });

    const sorted = Object.entries(agg).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(d => d[0]);
    const values = sorted.map(d => d[1]);
    const total = values.reduce((a, b) => a + b, 0);
    const colors = labels.map(l => COLORS.rooms[l] || '#94a3b8');

    if (charts.room) charts.room.destroy();
    charts.room = new Chart(document.getElementById('chart-room'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors.map(c => c + 'cc'),
                borderColor: 'rgba(11,15,26,0.8)',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 14,
                        usePointStyle: true,
                        pointStyleWidth: 10,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const pct = ((ctx.parsed / total) * 100).toFixed(1);
                            return ` ${ctx.label}: ${ctx.parsed.toLocaleString()} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

/* ===== Chart: Growth by Year ===== */
function renderGrowth(rows) {
    const agg = {};
    rows.forEach(r => {
        const y = r[5];
        agg[y] = (agg[y] || 0) + 1;
    });

    const sorted = Object.entries(agg)
        .map(([y, c]) => ({ year: +y, count: c }))
        .sort((a, b) => a.year - b.year);

    const labels = sorted.map(d => d.year);
    const values = sorted.map(d => d.count);

    // Avg reference line
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    if (charts.growth) charts.growth.destroy();
    charts.growth = new Chart(document.getElementById('chart-growth'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Listings',
                    data: values,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99,102,241,0.1)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointRadius: 3,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#0b0f1a',
                    pointBorderWidth: 2,
                    pointHoverRadius: 6
                },
                {
                    label: 'Average',
                    data: new Array(labels.length).fill(Math.round(avg)),
                    borderColor: 'rgba(148,163,184,0.4)',
                    borderDash: [6, 4],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { maxTicksLimit: 12 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    beginAtZero: true,
                    ticks: { callback: v => v.toLocaleString() }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}`
                    }
                }
            }
        }
    });
}

/* ===== Chart: Review Ratings by Borough ===== */
function renderRatings(rows) {
    const agg = {};
    rows.forEach(r => {
        const b = DATA.boroughs[r[0]];
        if (!agg[b]) agg[b] = { sum: 0, count: 0 };
        agg[b].sum += r[6];
        agg[b].count++;
    });

    const sorted = Object.entries(agg)
        .map(([b, v]) => ({ borough: b, avg: +(v.sum / v.count).toFixed(2) }))
        .sort((a, b) => b.avg - a.avg);

    const labels = sorted.map(d => d.borough);
    const values = sorted.map(d => d.avg);

    // Green gradient based on value
    const maxV = Math.max(...values);
    const greens = values.map(v => {
        const t = v / maxV;
        return `rgba(16, 185, 129, ${0.35 + t * 0.55})`;
    });
    const borders = values.map(v => {
        const t = v / maxV;
        return `rgba(16, 185, 129, ${0.6 + t * 0.4})`;
    });

    if (charts.ratings) charts.ratings.destroy();
    charts.ratings = new Chart(document.getElementById('chart-ratings'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: greens,
                borderColor: borders,
                borderWidth: 2,
                borderRadius: 8,
                barPercentage: 0.65
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    min: Math.floor(Math.min(...values) * 10 - 1) / 10,
                    ticks: { stepSize: 0.2 }
                },
                y: { grid: { display: false } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: ctx => ' Rating: ' + ctx.parsed.x.toFixed(2)
                    }
                }
            }
        }
    });
}

/* ===== Map ===== */
function renderMap() {
    const f = getFilters();

    // Filter map data
    let pts = DATA.map_data;
    if (f.borough !== 'all') pts = pts.filter(p => p.borough === f.borough);
    if (f.room !== 'all') pts = pts.filter(p => p.room_type === f.room);

    if (!map) {
        map = L.map('map', {
            center: [40.73, -73.95],
            zoom: 11,
            zoomControl: true,
            scrollWheelZoom: true
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
            maxZoom: 18
        }).addTo(map);
    }

    // Clear previous markers
    if (mapMarkers) map.removeLayer(mapMarkers);

    mapMarkers = L.layerGroup();
    pts.forEach(p => {
        const priceColor = priceToColor(p.price);
        const circle = L.circleMarker([p.lat, p.lng], {
            radius: 3.5,
            fillColor: priceColor,
            fillOpacity: 0.7,
            color: priceColor,
            weight: 0.5,
            opacity: 0.9
        });

        const name = p.name && p.name.length > 40 ? p.name.slice(0, 40) + '…' : p.name;
        circle.bindTooltip(
            `<strong>${name || 'Listing'}</strong><br>` +
            `Borough: ${p.borough}<br>` +
            `Price: $${p.price}/night<br>` +
            `Type: ${p.room_type}`,
            { direction: 'top', offset: [0, -6] }
        );

        mapMarkers.addLayer(circle);
    });

    mapMarkers.addTo(map);
}

function priceToColor(price) {
    // Low ($50) → blue, Mid ($500) → yellow, High ($1200) → red
    const t = Math.min(price / 1200, 1);
    if (t < 0.4) {
        const u = t / 0.4;
        return lerpColor('#3b82f6', '#f59e0b', u);
    } else {
        const u = (t - 0.4) / 0.6;
        return lerpColor('#f59e0b', '#ef4444', u);
    }
}

function lerpColor(a, b, t) {
    const ah = parseInt(a.slice(1), 16);
    const bh = parseInt(b.slice(1), 16);
    const ar = ah >> 16, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
    const br = bh >> 16, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}
