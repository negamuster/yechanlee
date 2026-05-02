import { useNavigate } from 'react-router-dom'

export default function GlobalMacro() {
  const navigate = useNavigate()

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: '"Times New Roman", Times, serif', color: '#000000' }}>

      {/* ── NAV ── */}
      <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
        <span onClick={() => navigate('/')} style={{ fontSize: '20px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>
      </nav>

      {/* ── HEADER ── */}
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: '80px 48px 64px' }}>
        <h1 style={{ fontSize: '52px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '28px', lineHeight: '1.1' }}>
          Global Macro
        </h1>
        <p style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '640px', textAlign: 'justify', wordBreak: 'keep-all' }}>
          내용을 여기에 추가하세요.
        </p>
      </section>

      {/* ── SECTIONS ── */}
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: '0 48px 160px' }}>
        <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '64px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.6fr',
            gap: '48px',
            padding: '56px 0',
            borderBottom: '1px solid #e8e8e8',
            alignItems: 'start',
          }}>
            <div>
              <p style={{ fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: '12px' }}>
                Section Label
              </p>
              <h2 style={{ fontSize: '36px', fontWeight: '400', letterSpacing: '-0.01em', lineHeight: '1.1', color: '#000' }}>
                Section Title
              </h2>
            </div>
            <div>
              <p style={{ fontSize: '16px', lineHeight: '1.85', color: '#444', textAlign: 'justify', wordBreak: 'keep-all' }}>
                내용을 여기에 추가하세요.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}