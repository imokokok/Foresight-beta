-- Add comments for main tables and columns in Foresight

COMMENT ON TABLE public.predictions IS '预测事件主表，存储所有预测事件的基础信息';
COMMENT ON COLUMN public.predictions.id IS '预测事件ID，自增主键';
COMMENT ON COLUMN public.predictions.title IS '事件标题（对用户展示）';
COMMENT ON COLUMN public.predictions.description IS '事件详细描述';
COMMENT ON COLUMN public.predictions.category IS '事件分类（中文名，例如 科技/体育/加密货币/更多）';
COMMENT ON COLUMN public.predictions.deadline IS '预测截止时间（到期后不能新建仓位）';
COMMENT ON COLUMN public.predictions.min_stake IS '参与该事件的最低仓位金额';
COMMENT ON COLUMN public.predictions.criteria IS '结算标准，说明如何判断事件结果';
COMMENT ON COLUMN public.predictions.image_url IS '封面图片URL';
COMMENT ON COLUMN public.predictions.reference_url IS '参考资料链接（新闻、数据源等）';
COMMENT ON COLUMN public.predictions.status IS '事件状态：active/ completed / cancelled';
COMMENT ON COLUMN public.predictions.created_at IS '创建时间';
COMMENT ON COLUMN public.predictions.updated_at IS '最近更新时间';
COMMENT ON COLUMN public.predictions.type IS '事件类型：binary（二元）或 multi（多元）';
COMMENT ON COLUMN public.predictions.outcome_count IS '事件的选项数量（用于前端与映射兜底）';
COMMENT ON COLUMN public.predictions.followers_count IS '关注该事件的用户数量缓存';

COMMENT ON TABLE public.categories IS '预测事件分类表，维护可用分类列表（中文名称）';
COMMENT ON COLUMN public.categories.id IS '分类ID，自增主键';
COMMENT ON COLUMN public.categories.name IS '分类名称（中文，例如 科技/体育/加密货币/更多）';

COMMENT ON TABLE public.event_follows IS '事件关注记录表，存储用户对事件的关注关系';
COMMENT ON COLUMN public.event_follows.id IS '关注记录ID，自增主键';
COMMENT ON COLUMN public.event_follows.user_id IS '用户标识（钱包地址或用户ID）';
COMMENT ON COLUMN public.event_follows.event_id IS '被关注的预测事件ID（predictions.id）';
COMMENT ON COLUMN public.event_follows.created_at IS '创建时间（开始关注时间）';

COMMENT ON TABLE public.prediction_outcomes IS '预测事件的选项集合；支持二元与多元统一表示';
COMMENT ON COLUMN public.prediction_outcomes.id IS '选项记录ID';
COMMENT ON COLUMN public.prediction_outcomes.prediction_id IS '关联预测事件ID';
COMMENT ON COLUMN public.prediction_outcomes.outcome_index IS '选项序号（从0开始，连续整数）';
COMMENT ON COLUMN public.prediction_outcomes.label IS '选项标签（显示用）';
COMMENT ON COLUMN public.prediction_outcomes.description IS '选项描述（可选）';
COMMENT ON COLUMN public.prediction_outcomes.color IS '选项颜色（可选）';
COMMENT ON COLUMN public.prediction_outcomes.image_url IS '选项图片URL（可选）';

COMMENT ON TABLE public.user_profiles IS '用户资料表，扩展钱包地址的显示信息与权限';
COMMENT ON COLUMN public.user_profiles.wallet_address IS '用户钱包地址，主键';
COMMENT ON COLUMN public.user_profiles.username IS '用户名/昵称';
COMMENT ON COLUMN public.user_profiles.email IS '邮箱地址';
COMMENT ON COLUMN public.user_profiles.is_admin IS '是否为管理员账号';
COMMENT ON COLUMN public.user_profiles.created_at IS '创建时间';
COMMENT ON COLUMN public.user_profiles.updated_at IS '最近更新时间';

COMMENT ON TABLE public.flags IS 'Flag 立项表，记录用户的自我挑战或目标';
COMMENT ON COLUMN public.flags.id IS 'Flag ID，自增主键';
COMMENT ON COLUMN public.flags.user_id IS '创建该 Flag 的用户ID/钱包地址';
COMMENT ON COLUMN public.flags.title IS 'Flag 标题';
COMMENT ON COLUMN public.flags.description IS 'Flag 描述';
COMMENT ON COLUMN public.flags.deadline IS '完成截止时间';
COMMENT ON COLUMN public.flags.verification_type IS '验证方式：self（自证）或 witness（他人见证）';
COMMENT ON COLUMN public.flags.status IS 'Flag 状态：active/pending_review/success/failed';
COMMENT ON COLUMN public.flags.proof_comment IS '用户提交的证明文字';
COMMENT ON COLUMN public.flags.proof_image_url IS '用户提交的证明图片';
COMMENT ON COLUMN public.flags.witness_id IS '见证人用户ID/钱包地址';
COMMENT ON COLUMN public.flags.created_at IS '创建时间';
COMMENT ON COLUMN public.flags.updated_at IS '最近更新时间';

COMMENT ON TABLE public.flag_checkins IS 'Flag 打卡记录表';
COMMENT ON COLUMN public.flag_checkins.id IS '打卡记录ID';
COMMENT ON COLUMN public.flag_checkins.flag_id IS '关联的 Flag ID';
COMMENT ON COLUMN public.flag_checkins.user_id IS '打卡用户ID/钱包地址';
COMMENT ON COLUMN public.flag_checkins.note IS '打卡备注说明';
COMMENT ON COLUMN public.flag_checkins.image_url IS '打卡截图或图片';
COMMENT ON COLUMN public.flag_checkins.created_at IS '打卡时间';
COMMENT ON COLUMN public.flag_checkins.review_status IS '审核状态：pending/approved/rejected';
COMMENT ON COLUMN public.flag_checkins.reviewer_id IS '审核人ID';
COMMENT ON COLUMN public.flag_checkins.review_reason IS '审核意见/原因';
COMMENT ON COLUMN public.flag_checkins.reviewed_at IS '审核时间';

COMMENT ON TABLE public.flag_settlements IS 'Flag 结算表，记录最终结论与奖励信息';
COMMENT ON COLUMN public.flag_settlements.id IS '结算记录ID';
COMMENT ON COLUMN public.flag_settlements.flag_id IS '关联的 Flag ID';
COMMENT ON COLUMN public.flag_settlements.status IS '结算结果：success/failed';
COMMENT ON COLUMN public.flag_settlements.settled_at IS '结算时间';

COMMENT ON TABLE public.forum_threads IS '论坛主题/提案表，对应某个预测事件的讨论串';
COMMENT ON COLUMN public.forum_threads.id IS '主题ID';
COMMENT ON COLUMN public.forum_threads.event_id IS '关联的预测事件ID（predictions.id）';
COMMENT ON COLUMN public.forum_threads.title IS '主题标题';
COMMENT ON COLUMN public.forum_threads.content IS '主题正文内容';
COMMENT ON COLUMN public.forum_threads.user_id IS '发起该主题的用户ID/钱包地址';
COMMENT ON COLUMN public.forum_threads.created_at IS '创建时间';
COMMENT ON COLUMN public.forum_threads.upvotes IS '点赞数量';
COMMENT ON COLUMN public.forum_threads.downvotes IS '点踩数量';
COMMENT ON COLUMN public.forum_threads.subject_name IS '自动生成标题时使用的主体名称';
COMMENT ON COLUMN public.forum_threads.action_verb IS '自动生成标题时使用的动作动词';
COMMENT ON COLUMN public.forum_threads.target_value IS '自动生成标题时使用的目标值/条件';
COMMENT ON COLUMN public.forum_threads.deadline IS '该讨论关联的截止时间（可选）';
COMMENT ON COLUMN public.forum_threads.category IS '该主题所属的分类（如 科技/体育 等）';
COMMENT ON COLUMN public.forum_threads.title_preview IS '自动生成的标题预览';
COMMENT ON COLUMN public.forum_threads.criteria_preview IS '自动生成的结算标准预览';
COMMENT ON COLUMN public.forum_threads.hot_since IS '被标记为热门的起始时间';
COMMENT ON COLUMN public.forum_threads.created_prediction_id IS '由该主题生成的预测事件ID（如有）';

COMMENT ON TABLE public.forum_comments IS '论坛评论表，记录主题下的所有回复和嵌套评论';
COMMENT ON COLUMN public.forum_comments.id IS '评论ID';
COMMENT ON COLUMN public.forum_comments.thread_id IS '所属主题ID';
COMMENT ON COLUMN public.forum_comments.event_id IS '关联的预测事件ID（如有）';
COMMENT ON COLUMN public.forum_comments.user_id IS '评论用户ID/钱包地址';
COMMENT ON COLUMN public.forum_comments.content IS '评论内容';
COMMENT ON COLUMN public.forum_comments.created_at IS '评论时间';
COMMENT ON COLUMN public.forum_comments.upvotes IS '点赞数量';
COMMENT ON COLUMN public.forum_comments.downvotes IS '点踩数量';
COMMENT ON COLUMN public.forum_comments.parent_id IS '父评论ID（用于楼中楼/回复）';

COMMENT ON TABLE public.forum_votes IS '论坛投票记录表，限制每个用户对同一内容仅投一次票';
COMMENT ON COLUMN public.forum_votes.id IS '投票记录ID';
COMMENT ON COLUMN public.forum_votes.user_id IS '投票用户ID/钱包地址';
COMMENT ON COLUMN public.forum_votes.event_id IS '关联的预测事件ID';
COMMENT ON COLUMN public.forum_votes.content_id IS '被投票的内容ID（thread 或 comment）';
COMMENT ON COLUMN public.forum_votes.content_type IS '内容类型：thread/comment';
COMMENT ON COLUMN public.forum_votes.vote_type IS '投票类型：up/down';
COMMENT ON COLUMN public.forum_votes.created_at IS '投票时间';

COMMENT ON TABLE public.discussions IS '提案/预测相关的长文讨论记录';
COMMENT ON COLUMN public.discussions.id IS '讨论记录ID';
COMMENT ON COLUMN public.discussions.proposal_id IS '关联提案ID（或论坛主题ID）';
COMMENT ON COLUMN public.discussions.user_id IS '发起讨论的用户ID/钱包地址';
COMMENT ON COLUMN public.discussions.content IS '讨论内容';
COMMENT ON COLUMN public.discussions.created_at IS '创建时间';

COMMENT ON TABLE public.orders IS '链上订单与订单簿映射表，用于记录挂单/撮合信息';
COMMENT ON COLUMN public.orders.id IS '订单记录ID';
COMMENT ON COLUMN public.orders.verifying_contract IS '订单验证合约地址';
COMMENT ON COLUMN public.orders.chain_id IS '区块链网络ID';
COMMENT ON COLUMN public.orders.market_key IS '事件市场的逻辑键（event_id + chain 等组合）';
COMMENT ON COLUMN public.orders.maker_address IS '挂单发起者地址';
COMMENT ON COLUMN public.orders.maker_salt IS '订单随机盐';
COMMENT ON COLUMN public.orders.outcome_index IS '交易的选项索引';
COMMENT ON COLUMN public.orders.is_buy IS '是否为买单（true=买，false=卖）';
COMMENT ON COLUMN public.orders.price IS '报价（文本存储，保持精度）';
COMMENT ON COLUMN public.orders.amount IS '订单总数量（文本存储）';
COMMENT ON COLUMN public.orders.remaining IS '订单剩余数量（文本存储）';
COMMENT ON COLUMN public.orders.expiry IS '订单过期时间（可为空）';
COMMENT ON COLUMN public.orders.signature IS '订单签名';
COMMENT ON COLUMN public.orders.status IS '订单状态，例如 open/filled/cancelled';
COMMENT ON COLUMN public.orders.sequence IS '自动递增序号，用于排序';
COMMENT ON COLUMN public.orders.created_at IS '创建时间';

COMMENT ON TABLE public.markets_map IS '预测事件到链上市场的映射（每事件+链唯一）';
COMMENT ON COLUMN public.markets_map.event_id IS '预测事件ID';
COMMENT ON COLUMN public.markets_map.chain_id IS '链ID，例如 80002、137 等';
COMMENT ON COLUMN public.markets_map.market IS '链上市场合约地址';
COMMENT ON COLUMN public.markets_map.collateral_token IS '该市场使用的保证金代币地址';
COMMENT ON COLUMN public.markets_map.tick_size IS '价格精度/最小报价单位';
COMMENT ON COLUMN public.markets_map.resolution_time IS '市场结算时间（如有）';
COMMENT ON COLUMN public.markets_map.status IS '市场状态：open/closed 等';
COMMENT ON COLUMN public.markets_map.created_at IS '创建时间';
COMMENT ON COLUMN public.markets_map.outcomes_count IS '该事件对应市场的选项数量（用于前端校验与兜底展示）';
