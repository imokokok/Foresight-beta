export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-4">隐私政策（Privacy Policy）</h1>
        <p className="text-sm text-gray-600 mb-8">最后更新：2025-11-07</p>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">1. 我们收集的信息</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>账户信息：邮箱地址、钱包账户、基础档案信息（如有）。</li>
            <li>认证数据：一次性验证码（OTP）、登录链接（魔法链接）、签名相关元数据（如 SIWE）。</li>
            <li>技术信息：设备信息、浏览器类型、语言、IP 地址、近似位置、日志与错误报告。</li>
            <li>使用数据：页面访问、点击、交互行为与偏好设置。</li>
          </ul>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">2. 我们如何使用信息</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>提供与维护服务：账户登录、用户识别、基础功能运行。</li>
            <li>安全与风控：验证身份、防止欺诈与滥用、记录异常与安全事件。</li>
            <li>产品优化：分析使用数据以改进体验与性能。</li>
            <li>通信与通知：发送与账户相关的通知（如验证码、登录链接、重要变更）。</li>
          </ul>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">3. Cookies 与本地存储</h2>
          <p>
            我们可能使用 Cookies、LocalStorage 或类似技术用于会话保持、偏好设置与分析。你可以在浏览器中管理相关设置，但禁用后部分功能可能不可用。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">4. 第三方服务与共享</h2>
          <p>
            为提供与改进服务，我们可能使用第三方服务（例如认证与数据库服务、钱包提供方、分析工具）。我们仅在必要范围内共享数据，且要求第三方遵守安全与隐私承诺。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">5. 数据安全</h2>
          <p>
            我们采取合理的技术与组织措施保护你的信息安全，但任何系统都无法保证绝对安全。你应妥善保管账户、邮箱与钱包的访问凭证。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">6. 数据保留</h2>
          <p>
            我们在实现上述目的所需的时间内保留你的信息，并在法律允许或要求的期限内保留相关日志与记录。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">7. 你的权利</h2>
          <p>
            根据适用法律，你可能拥有访问、更正、删除或请求导出你的个人信息的权利。你也可撤回同意或限制处理（在法律允许范围内）。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">8. 跨境传输</h2>
          <p>
            你的信息可能会被传输至你所在国家/地区之外的服务器或服务提供方，并依据适用法律采取相应的保护措施。
          </p>
        </section>

        <section className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">9. 政策更新</h2>
          <p>
            我们可能不时更新本隐私政策。更新后将于页面发布并即时生效。请定期查看以了解最新内容。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">10. 联系我们</h2>
          <p>
            如果你对隐私相关问题有任何疑问或请求，请通过平台内的联系方式与我们取得联系。
          </p>
        </section>
      </div>
    </main>
  );
}