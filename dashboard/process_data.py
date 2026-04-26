"""
Pre-process cleaned_airbnb_final.csv into compact JSON for the web dashboard.
Generates: dashboard_data.json
"""
import pandas as pd
import json
import numpy as np

df = pd.read_csv('../cleaned_airbnb_final.csv')
print(f"Loaded {len(df):,} rows")

# --- KPIs ---
kpis = {
    'total_listings': int(len(df)),
    'avg_price': round(float(df['price'].mean()), 2),
    'avg_availability': round(float(df['availability_365'].mean()), 1),
    'est_annual_revenue': round(float((df['price'] * (365 - df['availability_365'])).sum()), 0)
}

# --- Price by Borough ---
price_borough = (
    df.groupby('neighbourhood_group')['price']
    .mean().round(2)
    .sort_values(ascending=False)
    .reset_index()
    .rename(columns={'neighbourhood_group': 'borough', 'price': 'avg_price'})
    .to_dict('records')
)

# --- Room Type Breakdown ---
rc = df['room_type'].value_counts()
room_types = [
    {'type': t, 'count': int(c), 'pct': round(c / len(df) * 100, 1)}
    for t, c in rc.items()
]

# --- Growth by Year ---
growth = (
    df.groupby('construction_year')['id'].count()
    .reset_index()
    .rename(columns={'construction_year': 'year', 'id': 'count'})
    .sort_values('year')
    .to_dict('records')
)

# --- Ratings by Borough ---
ratings = (
    df.groupby('neighbourhood_group')['review_rate_number']
    .mean().round(2)
    .sort_values(ascending=False)
    .reset_index()
    .rename(columns={'neighbourhood_group': 'borough', 'review_rate_number': 'avg_rating'})
    .to_dict('records')
)

# --- Map: sample 2500 points ---
sample = df.sample(n=2500, random_state=42)
map_points = sample[['lat', 'long', 'price', 'neighbourhood_group', 'room_type', 'name']].copy()
map_points = map_points.rename(columns={'long': 'lng', 'neighbourhood_group': 'borough'})
map_points['price'] = map_points['price'].round(0).astype(int)
map_points['lat'] = map_points['lat'].round(5)
map_points['lng'] = map_points['lng'].round(5)
map_data = map_points.to_dict('records')

# --- Compact raw data for cross-filtering ---
# Encode strings as indices for smaller file
boroughs = sorted(df['neighbourhood_group'].unique().tolist())
room_list = sorted(df['room_type'].unique().tolist())
cancel_list = sorted(df['cancellation_policy'].unique().tolist())

borough_idx = {b: i for i, b in enumerate(boroughs)}
room_idx = {r: i for i, r in enumerate(room_list)}
cancel_idx = {c: i for i, c in enumerate(cancel_list)}

# Columns: borough_idx, room_idx, cancel_idx, price, availability, year, rating
raw_rows = []
for _, r in df.iterrows():
    raw_rows.append([
        borough_idx[r['neighbourhood_group']],
        room_idx[r['room_type']],
        cancel_idx[r['cancellation_policy']],
        int(r['price']),
        int(r['availability_365']),
        int(r['construction_year']),
        float(r['review_rate_number'])
    ])

data = {
    'kpis': kpis,
    'price_by_borough': price_borough,
    'room_types': room_types,
    'growth_by_year': growth,
    'ratings_by_borough': ratings,
    'map_data': map_data,
    'boroughs': boroughs,
    'room_type_list': room_list,
    'cancellation_list': cancel_list,
    'raw': raw_rows
}

with open('dashboard_data.json', 'w') as f:
    json.dump(data, f, separators=(',', ':'))

size_kb = len(json.dumps(data, separators=(',', ':'))) / 1024
print(f"✅ Generated dashboard_data.json ({size_kb:.0f} KB)")
print(f"   KPIs: {kpis}")
print(f"   Map points: {len(map_data)}")
print(f"   Raw rows: {len(raw_rows)}")
