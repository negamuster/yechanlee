import { useNavigate } from 'react-router-dom'

export default function Rates() {
  const navigate = useNavigate()

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: '"Times New Roman", Times, serif', color: '#000000' }}>

      {/* ── NAV ── */}
      <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
        <span onClick={() => navigate('/')} style={{ fontSize: '20px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>
        <span style={{ fontSize: '14px', color: '#aaa' }}>02 — Fed & Monetary Policy</span>
      </nav>

      {/* ── HEADER ── */}
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: '80px 48px 64px' }}>
        <p style={{ fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '24px' }}>
          02 / Fed & Monetary Policy
        </p>
        <h1 style={{ fontSize: '52px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '28px', lineHeight: '1.1' }}>
          Fed & Monetary Policy
        </h1>
        <p style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '640px', textAlign: 'justify', wordBreak: 'keep-all' }}>
          FOMC는 연간 8회의 회의를 통해 정책금리를 결정하며, 경기 둔화·부양과 인플레이션 억제 등 경제 상황에 따라 통화정책 방향을 조정합니다. 중앙은행은 공개시장조작(Open Market Operations)과 재할인율 정책(Discount Rate Policy) 등을 통해 유동성을 조절하며, 이를 통해 시장 전반에 영향을 미칩니다.
        </p>
      </section>

      {/* ── 내용 추가 구역 ── */}
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: '0 48px 160px' }}>
        <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '64px' }}>
          <p style={{ fontSize: '15px', lineHeight: '1.9', color: '#aaa' }}>
            섹션 내용을 추가해주세요.
          </p>
        </div>
      </section>

    </div>
  )
}