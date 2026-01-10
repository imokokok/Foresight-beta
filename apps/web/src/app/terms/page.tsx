export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-4">服务条款（Terms of Service）</h1>
        <p className="text-sm text-gray-600 mb-8">最后更新：2026-01-10</p>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">1. 适用范围</h2>
          <p>
            本条款适用于你访问与使用本平台网站与相关服务。你使用本平台即表示你已阅读并同意本条款。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">2. 账户与认证</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>你可能通过邮箱验证码、钱包签名等方式登录与验证身份。</li>
            <li>你应对你的账户、邮箱与钱包访问凭证承担保管责任。</li>
          </ul>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">3. 使用规则</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>你不得以任何方式干扰服务运行、绕过安全机制或滥用接口。</li>
            <li>你不得发布违法、侵权、欺诈或恶意内容。</li>
            <li>我们可能对异常行为采取限制措施以保护平台与用户安全。</li>
          </ul>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">4. 风险提示</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>区块链交易具有不可逆性，链上交互前请仔细核对信息。</li>
            <li>数字资产与相关市场存在波动与损失风险，你应自行评估并承担后果。</li>
          </ul>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">5. 免责声明</h2>
          <p>
            在适用法律允许范围内，本平台按“现状”提供服务。对于因不可抗力、第三方服务故障、
            网络中断、链上拥堵或其他非我们可合理控制因素导致的损失，我们不承担责任。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">6. 条款变更</h2>
          <p>
            我们可能不时更新本条款。更新后将于本页面发布并生效。你继续使用服务即视为接受更新后的条款。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">7. 联系我们</h2>
          <p>如对本条款有疑问，请通过平台内联系方式与我们联系。</p>
        </section>
      </div>
    </main>
  );
}
