import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { pinIcon } from '../lib/ui-helpers.js'

const TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'


function FitBounds({ points, padding = 32, maxZoom = 16 }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join('|')
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) map.setView(points[0], Math.min(maxZoom, 14))
    else map.fitBounds(L.latLngBounds(points), { padding: [padding, padding], maxZoom })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [target, map])
  return null
}

// 화면 크기 변화(탭 전환 등) 시 타일이 깨지지 않도록 크기 재계산
function ResizeFix() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])
  return null
}

/**
 * markers: [{ id, lat, lng, icon, popup, onClick }]
 * lines: [{ id, points: [[lat,lng]], color, weight, dash }]
 */
export default function MapView({ center = [36.4, 127.8], zoom = 7, markers = [], lines = [], circle, fit = [], flyTo, className = '', label = '지도' }) {
  return (
    <div className={`map ${className}`} role="region" aria-label={label}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={TILE} attribution={ATTR} maxZoom={19} />
        <ResizeFix />
        {fit.length > 0 && <FitBounds points={fit} />}
        {flyTo && <FlyTo target={flyTo} />}
        {circle && <Circle center={circle.center} radius={circle.radius} pathOptions={{ color: '#C98A3D', weight: 1.5, fillOpacity: 0.06 }} />}
        {lines.map((l) => (
          <Polyline key={l.id} positions={l.points} pathOptions={{ color: l.color || '#C98A3D', weight: l.weight || 5, opacity: 0.95, dashArray: l.dash, lineCap: 'round', lineJoin: 'round' }} />
        ))}
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={m.icon || pinIcon()} eventHandlers={m.onClick ? { click: m.onClick } : undefined} zIndexOffset={m.z || 0}>
            {m.popup && <Popup>{m.popup}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
