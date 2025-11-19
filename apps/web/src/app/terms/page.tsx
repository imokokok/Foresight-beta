export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-4">服务条款（Terms of Service）</h1>
        <p className="text-sm text-gray-600 mb-8">最后更新：2025-11-07</p>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">1. 接受条款</h2>
          <p>
            欢迎使用 Foresight（“我们”或“本平台”）。访问或使用本平台的任何功能即表示你已阅读、理解并同意受本服务条款约束。
            如果你不同意任何条款，请停止使用本平台。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">2. 资格与账户</h2>
          <p>
            你需具备在所在司法辖区使用本平台的合法资格。你可以通过邮箱（OTP/魔法链接）或钱包（如 MetaMask、Coinbase、OKX、Binance）登录，
            并可能进行基于签名的身份验证（如 SIWE）。你有责任对账户凭证和签名操作进行妥善保管。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">3. 邮箱与钱包登录</h2>
          <p>
            - 邮箱登录：我们可能向你的邮箱发送一次性验证码（OTP）或登录链接（魔法链接）。验证码应在有效期内使用，且仅限本人使用。
          </p>
          <p>
            - 钱包登录：你可以通过连接支持的钱包进行登录或签名。你知悉并同意，任何与钱包相关的风险（如私钥泄露、插件安全）由你自行承担。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">4. 使用规则与禁止行为</h2>
          <p>
            你同意不从事以下行为，包括但不限于：
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>违反适用法律法规或监管要求；</li>
            <li>干扰、攻击或绕过平台的安全与访问控制；</li>
            <li>冒用他人身份、进行欺诈或误导性行为；</li>
            <li>批量自动化爬取或超出合理范围的 API 滥用；</li>
            <li>发布或传播非法内容、恶意代码或侵犯他人权益的材料。</li>
          </ul>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">5. 市场与风险披露</h2>
          <p>
            本平台可能提供与预测、数据分析或市场相关的功能。你理解并同意：市场价格、数据与结论可能波动且存在不确定性，
            不构成任何投资建议或保证。你应自行评估风险并承担相应责任。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">6. 费用与结算</h2>
          <p>
            某些功能可能涉及费用或结算规则（例如网络手续费、服务费）。具体费率与结算方式以页面或通知说明为准，
            我们保留根据运营情况调整的权利。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">7. 免责声明</h2>
          <p>
            本平台按“现状”提供，不作任何明示或默示的保证，包括但不限于适销性、特定用途适用性或不侵权。
            在法律允许的范围内，我们不对因使用或无法使用本平台而导致的任何直接或间接损失负责。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">8. 知识产权</h2>
          <p>
            本平台的商标、标识、界面与内容受法律保护。未经授权，不得复制、修改、分发或用于商业目的。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">9. 终止与暂停</h2>
          <p>
            如我们合理认为你违反本条款或存在风险，我们可随时暂停或终止对你的服务，并采取必要措施以保障平台与用户安全。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">10. 条款变更</h2>
          <p>
            我们可能不时更新本条款。更新后将于页面发布并即时生效。继续使用即表示你接受更新后的条款。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">11. 联系我们</h2>
          <p>
            如有问题或建议，请通过平台内的联系方式与我们取得联系。
          </p>
        </section>
      </div>
    </main>
  );
}