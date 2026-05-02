import { useNavigate } from 'react-router-dom'

export default function Fred() {
  const navigate = useNavigate()
  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: '"Times New Roman", Times, serif', color: '#000000' }}>
      <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
        <span onClick={() => navigate('/')} style={{ fontSize: '18px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>
        <span style={{ fontSize: '13px', color: '#aaa' }}>04 — FRED Indicators</span>
      </nav>
      <section style={{ maxWidth: '720px', margin: '0 auto', padding: '80px 48px 160px' }}>
        <h1 style={{ fontSize: '48px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '48px', lineHeight: '1.1' }}>FRED Indicators</h1>
        <p style={{ fontSize: '15px', lineHeight: '1.9', color: '#333', marginBottom: '24px' }}>
          내용을 여기에 추가하세요.
        </p>
      </section>
    </div>
  )
}