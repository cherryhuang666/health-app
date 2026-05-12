/* =====================================================================
 * 我的健康档案 (My Health Records)
 * Vanilla JS · LocalStorage · PWA · Mobile-first
 * =====================================================================*/

/* ---------- 1. CONSTANTS & SCHEMA ---------- */

const STORAGE_KEY = 'health-app:v1';
/** 多设备同步：API 基址（如 https://你的用户名.pythonanywhere.com）与本机 Bearer 令牌 */
const SYNC_URL_KEY = 'health-app:sync-url';
const SYNC_TOKEN_KEY = 'health-app:sync-token';
const CLOUD_DEBOUNCE_MS = 900;
/** 前台定时拉取云端较新存档（与启动时逻辑一致：仅当云端 savedAt 更大时覆盖本机） */
const CLOUD_AUTO_PULL_INTERVAL_MS = 120_000;
/** 切回标签 / pageshow 时短防抖，避免连续两次请求 */
const CLOUD_VISIBILITY_PULL_DELAY_MS = 400;

// Pain locations covered in the original spreadsheet
const PAIN_PARTS = [
  { key: 'headache',    label: '头痛',   emoji: '🤕' },
  { key: 'backPain',    label: '腰背痛', emoji: '🧎' },
  { key: 'tailbone',    label: '尾骨痛', emoji: '🦴' },
  { key: 'belly',       label: '肚子痛', emoji: '🫃' },
  { key: 'anus',        label: '肛门不适', emoji: '😣' },
  { key: 'breast',      label: '乳房痛', emoji: '🤍' },
  { key: 'mood',        label: '情绪',   emoji: '🧠' },
  { key: 'fatigue',     label: '乏力',   emoji: '😪' },
];

// Common medications from the user's spreadsheet
const MEDICATIONS = [
  { key: 'liFeiYa',     label: '利飞亚'   },
  { key: 'luoShaTeng',  label: '罗莎疼'   },
  { key: 'coldMed',     label: '感冒药'   },
  { key: 'ointment',    label: '清凉药膏' },
  { key: 'painkiller',  label: '止痛药'   },
  { key: 'liRuiKa',     label: '利瑞卡'   },
  { key: 'zanAnNuo',    label: '赞安诺'   },
  { key: 'tcm',         label: '中药'     },
];

// Clinic categories
const CLINICS = [
  { key: '妇产',  label: '妇产科',  emoji: '🌸' },
  { key: '神内',  label: '神经内科', emoji: '🧠' },
  { key: '复健',  label: '复健科',  emoji: '💪' },
  { key: '乳房',  label: '乳房外科', emoji: '🎗️' },
  { key: '胸腔',  label: '胸腔科',  emoji: '🫁' },
  { key: '甲状',  label: '甲状腺科', emoji: '🦋' },
  { key: '中医',  label: '中医',    emoji: '🌿' },
  { key: '耳鼻',  label: '耳鼻喉科', emoji: '👂' },
  { key: '牙科',  label: '牙科',    emoji: '🦷' },
  { key: '眼科',  label: '眼科',    emoji: '👁️' },
  { key: '身心',  label: '身心科',  emoji: '🧘' },
  { key: '外科',  label: '外科',    emoji: '🔪' },
  { key: '胃肠',  label: '胃肠科',  emoji: '🍽️' },
  { key: '骨科',  label: '骨科',    emoji: '🦴' },
  { key: '皮肤',  label: '皮肤科',  emoji: '🤲' },
  { key: '其他',  label: '其他',    emoji: '🏥' },
];

// Insurance providers (扩展自 Excel：南山、全球、健保局)
const INSURERS = [
  { key: '南山',     label: '南山理赔'   },
  { key: '全球',     label: '全球理赔'   },
  { key: '健保局',   label: '健保局'     },
];

const CLAIM_STATUS = [
  { key: 'pending',  label: '待提交', color: 'bg-slate-100 text-slate-600' },
  { key: 'submitted',label: '已提交', color: 'bg-amber-100 text-amber-700' },
  { key: 'approved', label: '已核准', color: 'bg-blue-100 text-blue-700' },
  { key: 'paid',     label: '已到账', color: 'bg-green-100 text-green-700' },
  { key: 'denied',   label: '拒赔',   color: 'bg-red-100 text-red-700' },
];

/* =====================================================================
 * 1b · 每日寄语数据（庞大 + 可组合）
 * 逻辑在 loadState() 之后（需读取 state.customEncouragements）。
 * ===================================================================== */

const ENCOURAGEMENT_CORE = [
  '张婷，你今天能起床、能照顾自己，已经很棒了。',
  '情绪低落不是你的错，它只是身体在请求休息。',
  '不需要事事做到最好——今天能呼吸、能吃饭，就已经够了。',
  '你比你想象中坚强。已经走过了那么多。',
  '张婷，允许自己今天慢一点。世界不会因此倒塌。',
  '你不需要"积极"才有资格被爱。',
  '心情像天气，会变。今天的乌云不代表永远的天空。',
  '你已经在尽力了，就算别人看不见，我看得见。',
  '今天有没有喝一杯温水？身体也想要被照顾。',
  '张婷，难过的时候不一定要笑。难过本身没有错。',
  '你不是一个人——这个 app、家人、医生，都在陪你。',
  '慢慢来，没关系。康复从来都不是直线。',
  '此刻的你，已经足够好。',
  '一片云会飘走，一阵雨会停。情绪也是。',
  '张婷，今天的目标可以只是"撑过去"，这不丢人。',
  '哪怕只是洗个脸、吃一口饭，都值得被你自己肯定。',
  '你不必时时刻刻都坚强。脆弱也是人的一部分。',
  '不开心的时候，可以听一首歌、看一张老照片，抱抱自己。',
  '张婷，请记得：你值得被温柔对待，也包括被自己温柔对待。',
  '不必为休息感到内疚。休息也是治疗的一部分。',
  '想哭就哭，眼泪没有错。',
  '你做的小事——记录、吃药、好好睡觉——都在帮未来的你。',
  '今天的天空、阳光、风，都欢迎你。',
  '张婷，谢谢你今天还在这里。',
  '不必和昨天比，不必和别人比。和此刻的自己和解就好。',
  '抑郁是病，不是性格缺陷。你没有错。',
  '你的存在本身就有意义，不需要做什么来"证明"。',
  '一步、一口饭、一次深呼吸——都算数。',
  '想说“我不行”的时候，对自己说：“我可以慢一点。”',
  '张婷，今天可以不用做家务、不必锻炼，允许什么都不做也没关系。',
  '这个世界很复杂，但你不必把所有事都扛在肩上。',
  '你的感受是真实的，不需要别人说“想开点”。',
  '不开心可以告诉家人、朋友、医生——说出来本身就是一种照顾。',
  '张婷，你不是负担。爱你的人不会这样想。',
  '你愿意记录身体，就是在好好爱自己的开始。',
  '张婷，下次很难过的时候，试试吸气 4 秒、吐气 6 秒。',
  '你不需要变成“更好的自己”才配快乐。',
  '此刻就够。慢慢来。',
  '哪怕全世界都误解你，你也要站在自己这一边。',
  '张婷，记得吃药、喝水、按时复诊。这些都是爱自己。',
  '一年只有几次春天，但每一年，春天都会来。',
  '你不是一个人在和这个病作斗争——很多人都在并肩。',
  '今天可以原谅自己的“做不到”。',
  '张婷，愿你今晚能被安稳的睡意接住。',
  '你不需要解释自己为什么累。你累就是事实。',
  '心里有黑洞的时候，也请相信光会慢慢回来。',
  '你的善意、你的话、你曾经给过的温暖，都还在世间流转。',
  '给自己一些时间。康复从来不是赛跑。',
  '张婷，谢谢你愿意一次次为自己伸出手。',
  '你已经熬过了一切你以为熬不过去的那天。',
  '今天能察觉到一个小小的好，就已经很厉害了。',
  '张婷，你比想象中更值得被接住。',
  '难过时抱抱自己——这个拥抱是货真价实的。',
  '不论此刻多糟，请记住：“此刻不会是永远”。',
  '张婷，你只是生了病，没有“坏了”。',
  '真实地难过也是一种勇敢——不必装作没事。',
  '即使什么都没完成，你今天依然有被爱的资格。',
  '你的价值，从不等于你今天产出了多少。',
  '张婷，请把分给别人的体贴，悄悄留一勺给自己。',
  '焦虑在身体尖叫时，先照顾身体，它比道理更诚实。',
  '脑子乱成一团也没关系，慢慢来整理，一次一根线。',
  '若今天社交很累，离线一下完全合理。',
  '张婷，你不需要对每个人的期待都回应。',
  '感到麻木不是冷漠，有时是系统在保护自己。',
  '睡眠不好也别自责，那是昼夜节律在捣乱，不是你“不行”。',
  '若食欲忽高忽低，身体在说话，你听一听就好。',
  '今天若不想见人，那就不见——自保也是医疗。',
  '张婷，小步前进也是前进。',
  '若脑袋里对自己很凶，试试换一句像在安慰好朋友的话。',
  '抑郁骗你说“毫无意义”，但它的声音不代表真相。',
  '有时候什么都不想，就只是坐着，也很好。',
  '张婷，阳光照不到的地方，青苔也会静静绿。',
  '若想起伤心事，让它们浮现一下，再给它们一点时间离开。',
  '你的耐心对自己用一次，也值得。',
  '今天若只有力气刷牙，那把牙刷就是你今天的勋章。',
  '张婷，被理解很难，但被自己理解可以很温柔。',
  '若心里空空的，就放一首慢歌，陪陪那个空。',
  '别人的节奏不是你的节奏，你的节拍自有音乐。',
  '张婷，你早已证明：再难的日子，也都有过去的可能。',
  '若泪腺像坏了的水龙头，就任它一阵子，修好之前先让它流。',
  '身体痛的时候，情绪和痛常常叠在一起——都允许存在。',
  '今天若觉得世界吵，耳塞、窗帘、关灯，都算正当防卫。',
  '张婷，有时“我还活着”就是最诚实、最重要的成就。',
  '若睡不好，别把锅全背在自己身上。',
  '你记录下的每一页，是未来回顾时递给当时的自己的拥抱。',
  '张婷，被需要之前，请先确认自己有被照护的空间。',
  '若怀疑“我是不是给别人添麻烦”，也请记得你也是“别人”之一。',
  '心里的小孩若还在害怕，哄哄她也没关系。',
  '张婷，风会停，雨会歇，你也是。',
  '今天若提不起兴趣，提不起就提不起——兴趣会自己回来串门。',
  '若觉得自己“没用”，那只是病在压低音量，不是你的音量。',
  '张婷，你不必为情绪波动道歉。',
  '若食欲像过山车，给身体一点信任，身体会调整。',
  '今天若只有力气晒一分钟太阳，那也是光合作用级别的治愈。',
  '张婷，把“我必须”改成“我可以试试”，身体会松一点。',
  '若脑袋里反复回放糟糕画面，那是在消化，不是要惩罚你。',
  '张婷，你不需要把自己修成完人再开始生活。',
  '若对世界失望，就只把希望放在下一顿饭、下一次呼吸。',
  '今天若说不出话，沉默也是完整的句子。',
  '张婷，你经历的苦，没有把“你是谁”擦掉。',
];

const ENC_CMP_PREFIX = ['', '张婷，', '婷婷，', '亲爱的张婷，'];
const ENC_CMP_KERNEL = [
  '今天你不必向世界证明任何事。',
  '若心里空空或很乱，都正常。',
  '若只想躺着，也请允许。',
  '若眼泪自己掉下来，接住它。',
  '若吃不下，小口试试也没问题。',
  '若睡不着别逼自己——困意会在它愿意的时候来访。',
  '若头痛或身体别处不适，你是在记录，就是在好好对自己。',
  '若心里骂自己没用，请先停一拍，像在安慰挚友那样说话。',
  '若提不起劲做任何“有用”的事，呼吸已经够有用。',
  '若今天想见人就见，不想见就不必勉强。',
  '若焦虑像拧紧的发条，松松手指也可以。',
  '若快乐像走远的朋友，它不意味着永远不会回来串门。',
  '若回忆很难，允许自己慢一点翻页。',
  '若对未来害怕，把注意力放在下一口水、下一次呼气。',
  '若觉得自己是负担——负担也是暂时贴上的标签，不是你的名字。',
];
const ENC_CMP_TAIL = ['', '慢慢来。', '这已经很够了。', '我会站在你这边。', '给身体一点时间。'];
const ENC_SEASON_NOTE = [
  '窗外季节在换，你也在自己的小节奏里慢慢换。',
  '天冷或天热，都只穿让你舒服的一层温柔。',
];

/* ---------- 2. UTILITIES ---------- */


const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function fmtDateLong(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const week = ['日','一','二','三','四','五','六'][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 周${week}`;
}

function daysBetween(a, b) {
  const ms = new Date(b) - new Date(a);
  return Math.round(ms / 86400000);
}

/**
 * 使用 Flatpickr 中文语言包绑定日期输入（YYYY-MM-DD），避免系统英文时原生日历仍为英文。
 * CDN 需在 app.js 前加载 flatpickr + l10n/zh。
 */
function attachChineseDatePicker(inputEl, isoValue) {
  if (!inputEl || typeof flatpickr !== 'function') return;
  if (inputEl._fp) {
    try { inputEl._fp.destroy(); } catch (_) {}
    inputEl._fp = null;
  }
  const zh = typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.zh
    ? flatpickr.l10ns.zh : null;
  inputEl._fp = flatpickr(inputEl, {
    locale: zh || undefined,
    dateFormat: 'Y-m-d',
    defaultDate: isoValue || undefined,
    allowInput: true,
    disableMobile: true,
    monthSelectorType: 'dropdown',
  });
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toast(msg, type = 'info') {
  const root = $('#toastRoot');
  const el = document.createElement('div');
  el.className = 'toast';
  if (type === 'error') el.style.background = '#dc2626';
  if (type === 'success') el.style.background = '#16a34a';
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.25s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 260);
  }, 1800);
}

function painClass(n) {
  const v = Math.max(0, Math.min(10, Math.round(n || 0)));
  return `pain-pill pain-${v}`;
}

/* Excel serial date -> ISO date (used by importer) */
function excelSerialToISO(n) {
  if (typeof n !== 'number' || !isFinite(n)) return null;
  // Excel epoch is 1899-12-30 (accounting for the 1900 leap-year bug)
  const ms = (n - 25569) * 86400 * 1000;
  const d = new Date(ms);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
}

/* =====================================================================
 * Appointment / follow-up date parser
 * Extracts Chinese date phrases from free-text notes:
 *   - 绝对：2024年11月1日 / 11月1日 / 11/1 / 11月1号
 *   - 相对：半年后追踪 / 一年后回诊 / 两年追踪 / 3个月后 / 2周后 / 10天后
 * Relative dates are computed against the note's own date (baseDateISO).
 * ===================================================================== */

const APPT_KEYWORDS = /(复诊|回诊|追踪|预约|挂号|约诊|约门诊|看诊|看[\u4e00-\u9fa5]{1,3}科|大肠镜|胃镜|做手术|手术|检查|穿刺|抽血|拿药|开药|监测|超音波|超声|看报告|拿报告|拍片|核磁|CT|MRI|X光|拍X|心电图|体检|疫苗|打疫苗|追加疫苗|换药|拆线)/i;

const CN_NUM = { '零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };
function _parseCnOrArabicNum(s) {
  s = String(s || '').trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (s in CN_NUM) return CN_NUM[s];
  // "十二" / "二十"
  if (s.length === 2 && s[0] === '十') return 10 + (CN_NUM[s[1]] || 0);
  if (s.length === 2 && s[1] === '十') return (CN_NUM[s[0]] || 0) * 10;
  if (s.length === 3 && s[1] === '十') return (CN_NUM[s[0]] || 0) * 10 + (CN_NUM[s[2]] || 0);
  return null;
}

function _addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Math.round(months));
  // clamp to end of month
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}
function _addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function _atMidnight(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * "11月1日" 写在哪天日记 / 哪天看诊里，年份应贴着那条记录的日期，
 * 而不是从今天（2026）往未来推——否则会变成 2026-11-01。
 * @param {number} month0  JS 月份 0–11
 * @param {number} dom    日期 1–31
 * @param {string|null} anchorISO  记录的日期 yyyy-mm-dd（日记日 / 看诊日）；无则用今天
 */
function resolveMonthDayAgainstAnchor(month0, dom, anchorISO) {
  const anchor = anchorISO ? _atMidnight(new Date(anchorISO)) : _atMidnight(new Date());
  if (isNaN(anchor.getTime())) return null;
  let y = anchor.getFullYear();
  let cand = _atMidnight(new Date(y, month0, dom));
  let guard = 0;
  while (cand < anchor && guard < 30) {
    y++;
    cand = _atMidnight(new Date(y, month0, dom));
    guard++;
  }
  return isNaN(cand.getTime()) ? null : cand;
}

/**
 * Parse the first appointment-like date in `text`.
 * @param {string} text
 * @param {string} baseDateISO ISO date string for relative ("半年后") resolution
 * @param {boolean} requireKeyword if true, only return a date when an appointment keyword is also present
 * @returns {Date|null}
 */
function parseAppointmentDate(text, baseDateISO, requireKeyword = false) {
  if (!text) return null;
  const t = String(text);
  if (requireKeyword && !APPT_KEYWORDS.test(t)) return null;

  const today = _atMidnight(new Date());
  const base = baseDateISO ? _atMidnight(new Date(baseDateISO)) : today;

  // 1) Full date YYYY-MM-DD or YYYY年M月D[日号]?
  let m = t.match(/(\d{4})\s*[-年/.]\s*(\d{1,2})\s*[-月/.]\s*(\d{1,2})\s*[日号]?/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (!isNaN(d)) return d;
  }

  // 2) Month-day "M月D日" / "M月D号" — 年份对齐到 base（日记/看诊写的是哪一天）
  m = t.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/);
  if (m) {
    const month = +m[1] - 1, day = +m[2];
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return resolveMonthDayAgainstAnchor(month, day, baseDateISO || todayStr());
    }
  }

  // 3) M/D （有关键词时）— 同上，相对记录日期推算年
  if (APPT_KEYWORDS.test(t)) {
    m = t.match(/(?:^|[^\d])(\d{1,2})\s*\/\s*(\d{1,2})(?!\d)/);
    if (m) {
      const month = +m[1] - 1, day = +m[2];
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        return resolveMonthDayAgainstAnchor(month, day, baseDateISO || todayStr());
      }
    }
  }

  // 4) Relative — only meaningful when the phrase also signals an appointment
  if (APPT_KEYWORDS.test(t) || /[后内再]\s*$/.test(t) || /(追踪|回诊|复诊)/.test(t)) {
    // 半年|一年|两年|X年
    m = t.match(/(半|[零一二两三四五六七八九十]+|\d+)\s*年\s*(?:后|内|再)?/);
    if (m) {
      const n = m[1] === '半' ? 0.5 : _parseCnOrArabicNum(m[1]);
      if (n) return _addMonths(base, n * 12);
    }
    // 半个月 | X个月 | X月
    m = t.match(/(半|[零一二两三四五六七八九十]+|\d+)\s*个?\s*月\s*(?:后|内|再)/);
    if (m) {
      const n = m[1] === '半' ? 0.5 : _parseCnOrArabicNum(m[1]);
      if (n) return _addMonths(base, n);
    }
    // X周 / X星期
    m = t.match(/(半|[零一二两三四五六七八九十]+|\d+)\s*(?:个)?\s*(?:周|星期)\s*(?:后|内|再)?/);
    if (m) {
      const n = m[1] === '半' ? 0.5 : _parseCnOrArabicNum(m[1]);
      if (n) return _addDays(base, n * 7);
    }
    // X天/日
    m = t.match(/(半|[零一二两三四五六七八九十]+|\d+)\s*[天日]\s*(?:后|内|再)/);
    if (m) {
      const n = m[1] === '半' ? 0.5 : _parseCnOrArabicNum(m[1]);
      if (n) return _addDays(base, n);
    }
  }

  return null;
}

/** 首页「即将到来」提醒最远展示从今天起的天数（半年约 180 天；避免一年过长） */
const UPCOMING_REMINDER_HORIZON_DAYS = 180;

/**
 * Find appointments in the next `horizonDays` from today.
 * Sources scanned:
 *   - visit.followUp        (trusted, no keyword required)
 *   - visit.summary         (keyword required)
 *   - daily.summary         (keyword required)
 *   - daily.bowel/customMeds: NOT scanned (too noisy)
 */
function extractUpcomingReminders(horizonDays = UPCOMING_REMINDER_HORIZON_DAYS) {
  const today = _atMidnight(new Date());
  const horizon = _addDays(today, horizonDays);
  const out = [];

  for (const v of state.visits) {
    if (v.followUp) {
      const d = parseAppointmentDate(v.followUp, v.date, false);
      if (d) out.push({
        date: d, text: v.followUp, sourceKind: 'visit', sourceId: v.id,
        logDateISO: v.date,
        clinic: v.clinic, doctor: v.doctor, kind: 'followUp'
      });
    }
    if (v.summary) {
      const d = parseAppointmentDate(v.summary, v.date, true);
      if (d) out.push({
        date: d, text: v.summary, sourceKind: 'visit', sourceId: v.id,
        logDateISO: v.date,
        clinic: v.clinic, doctor: v.doctor, kind: 'visitNote'
      });
    }
  }
  for (const d of state.daily) {
    if (!d.summary) continue;
    const dt = parseAppointmentDate(d.summary, d.date, true);
    if (dt) out.push({
      date: dt, text: d.summary, sourceKind: 'daily', sourceId: d.id,
      logDateISO: d.date,
      sourceDate: d.date, kind: 'dailyNote'
    });
  }

  // Keep only future-or-today, within horizon
  const filtered = out.filter(r => r.date >= today && r.date <= horizon);

  // Dedupe by (yyyy-mm-dd + truncated text) so the same event in both a daily
  // summary and a visit doesn't appear twice
  const seen = new Set();
  const deduped = [];
  for (const r of filtered.sort((a, b) => a.date - b.date)) {
    const key = r.date.toISOString().slice(0, 10) + '|' +
                (r.text || '').replace(/\s+/g, '').slice(0, 30);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }
  return deduped;
}

function relativeDayLabel(date) {
  const today = _atMidnight(new Date());
  const dt = _atMidnight(date);
  const diff = Math.round((dt - today) / 86400000);
  if (diff === 0) return { text: '今天', tone: 'urgent' };
  if (diff === 1) return { text: '明天', tone: 'urgent' };
  if (diff <= 7)  return { text: `还有 ${diff} 天`, tone: 'urgent' };
  if (diff <= 30) return { text: `还有 ${diff} 天`, tone: 'soon' };
  // For dates >30 days away, show absolute date
  const week = ['日','一','二','三','四','五','六'][dt.getDay()];
  return {
    text: `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日 周${week}`,
    tone: 'later'
  };
}

/**
 * 「医生汇报草稿」正文：仅用本地已有的日记/复诊提醒/看诊拼出要点，不接外网 AI。
 */
function generateDoctorReportBrief() {
  const todayISO = todayStr();
  const lines = [];

  lines.push('【见医生时可以这样开口｜以下内容根据本 App 本地记录自动生成，请核对后再说】');
  lines.push('');
  lines.push(`· 若以今天为准：${fmtDateLong(todayISO)}。`);
  lines.push('');

  const upcoming = extractUpcomingReminders(UPCOMING_REMINDER_HORIZON_DAYS).slice(0, 5);
  if (upcoming.length) {
    lines.push('① 近期安排在记录里写过的时间点（可把这几句先念给医生）：');
    upcoming.forEach(r => {
      const iso = r.date.toISOString().slice(0, 10);
      const dept = r.clinic ? findClinic(r.clinic).label : '';
      const when = `${fmtDate(iso)}（${relativeDayLabel(r.date).text}）`;
      const snippet = String(r.text || '').replace(/\s+/g, ' ').trim();
      const clip = snippet.length > 130 ? snippet.slice(0, 130) + '…' : snippet;
      lines.push(`  · ${when}${dept ? ' · 相关科室/背景：' + dept : ''}`);
      lines.push(`    「${clip}」`);
      lines.push('');
    });
  } else {
    lines.push('① 近期复诊：暂时没有从日记/看诊里解析到「带日期的」即将到来的条目。可把「×月×日」「×科」写进当日摘要方便下次自动生成。');
    lines.push('');
  }

  const last21 = state.daily
    .filter(d => d.date && daysBetween(d.date, todayISO) <= 21 && daysBetween(d.date, todayISO) >= 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (last21.length) {
    const hd = last21.filter(d => (d.pains?.headache || 0) > 0).length;
    lines.push(`② 大约近三周的日记摘要（共写过 ${last21.length} 天）：`);
    const painBits = [];
    getAllPainParts().forEach(p => {
      const hi = Math.max(...last21.map(d => d.pains?.[p.key] || 0), 0);
      if (hi > 0) painBits.push(`${p.label}最高约${Math.round(hi)}度`);
    });
    lines.push(`  · 其中报告头痛约有 ${hd} 天${painBits.length ? '；' + painBits.join('，') : '。'}。`);
    lines.push('');
    lines.push('  · 最近在日记里这样描述身体（可作口头补充）：');
    last21.slice(0, 8).forEach(d => {
      if (!d.summary) return;
      const s = d.summary.replace(/\s+/g, ' ').trim();
      lines.push(`    — ${fmtDate(d.date)}：${s.slice(0, 100)}${s.length > 100 ? '…' : ''}`);
    });
    lines.push('');
  } else {
    lines.push('② 近两、三周还没有每日记录，可把症状先简单补几笔便于生成草稿。');
    lines.push('');
  }

  const recentVisits = state.visits
    .filter(v => v.date && daysBetween(v.date, todayISO) <= 45 && daysBetween(v.date, todayISO) >= 0)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 4);
  if (recentVisits.length) {
    lines.push('③ 最近几次看诊（挑重点告诉医生）：');
    recentVisits.forEach(v => {
      const sm = String(v.summary || '').replace(/\s+/g, ' ').trim();
      const clip = sm.length > 140 ? sm.slice(0, 140) + '…' : sm || '（暂无小结）';
      lines.push(`  · ${fmtDate(v.date)} ${findClinic(v.clinic).label}${v.doctor ? ' · ' + v.doctor : ''}`);
      lines.push(`    「${clip}」`);
      lines.push('');
    });
  }

  lines.push('④ 我还想补充的点（可把下面两行改成你想说的话）：');
  lines.push('  · （药物过敏 / 家族史 / 最关心的一个症状 /想换的药…）');
  lines.push('');
  lines.push('— 以上为草稿；到诊时请以自己的感受为准，可当场划掉不适用句子。');

  return lines.join('\n');
}

/* Parse "3度" / "2" / "微" into a 0-10 pain score */
function parsePainText(text) {
  if (text == null) return null;
  const s = String(text).trim();
  if (!s) return null;
  if (/微/.test(s)) return 1;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (m) {
    const n = parseFloat(m[1]);
    if (isFinite(n)) return Math.max(0, Math.min(10, n));
  }
  return null;
}

/* ---------- 3. STATE / STORAGE ---------- */

const defaultState = () => ({
  version: 1,
  daily:    [],   // { id, date, weekday, pains:{key:level}, meds:{key:bool}, customMeds:[], bowel, summary, tags:[] }
  vaccines: [],   // { id, date, name, dose, duration, location, notes }
  visits:   [],   // { id, date, clinic, doctor, summary, prescription, followUp, attachments:[] }
  claims:   [],   // { id, date, insurer, type, amount, currency, description, status, relatedVisitIds:[] }
  customClinics:   [], // [{ key, label, emoji }] - user-defined extra clinics
  customPainParts: [], // [{ key, label, emoji }] - user-defined extra body issues
  customMedItems:  [], // [{ key, label }]        - user-defined extra medications
  customInsurers:  [], // [{ key, label }]        - user-defined extra insurers
  /** 张婷自定义的每日寄语句子（每条一行）；与内置句子合并进池 */
  customEncouragements: [],
  /** 首页「医生汇报」可编辑草稿（可自行修改后保存） */
  doctorReportBriefing: '',
  /** 全应用字号：standard | large | xlarge（随本地存档保存） */
  uiFontScale: 'standard',
  /** 本地/云端单调递增时间戳，用于合并时选较新的一份（毫秒） */
  savedAt: 0,
});

function trimSyncUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let u = raw.trim();
  if (!u) return '';
  while (u.endsWith('/')) u = u.slice(0, -1);
  return u;
}

function getSyncConfig() {
  try {
    return {
      baseUrl: trimSyncUrl(localStorage.getItem(SYNC_URL_KEY)),
      token: (localStorage.getItem(SYNC_TOKEN_KEY) || '').trim(),
    };
  } catch (_) {
    return { baseUrl: '', token: '' };
  }
}

function setSyncConfig(baseUrl, token) {
  const u = trimSyncUrl(baseUrl);
  const t = (token || '').trim();
  if (u) localStorage.setItem(SYNC_URL_KEY, u);
  else localStorage.removeItem(SYNC_URL_KEY);
  if (t) localStorage.setItem(SYNC_TOKEN_KEY, t);
  else localStorage.removeItem(SYNC_TOKEN_KEY);
}

let _remotePushTimer = null;
let _cloudAutoPullIntervalId = null;
let _cloudVisibilityPullTimer = null;

function normalizeSavedAt(ms) {
  const n = Number(ms);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function syncFetch(path, opts = {}) {
  const { baseUrl, token } = getSyncConfig();
  if (!baseUrl || !token) throw new Error('未配置云端地址或同步码');
  const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  const headers = new Headers(opts.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text().catch(() => '');
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch (_) {}
  return { ok: res.ok, status: res.status, body };
}

async function syncPullFromRemote() {
  const { ok, status, body } = await syncFetch('/api/health-sync', {
    cache: 'no-store',
    method: 'GET',
  });
  if (status === 401) throw new Error('同步码错误或无效');
  if (status === 503) throw new Error((body && body.error) || '服务器未启用同步（需设置 HEALTH_SYNC_TOKEN）');
  if (status >= 400) throw new Error((body && body.error) || `云端错误 (${status})`);
  if (!ok) throw new Error('无法从云端拉取');
  if (!body || typeof body !== 'object') throw new Error('云端响应无效');
  if (body.state === null || body.state === undefined) return null;
  if (typeof body.state !== 'object') throw new Error('云端数据格式错误');
  return body;
}

async function syncPushFullState() {
  const { ok, status, body } = await syncFetch('/api/health-sync', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(state),
  });
  if (status === 401) throw new Error('同步码错误或无效');
  if (status >= 400) throw new Error((body && body.error) || `云端拒绝保存 (${status})`);
  return ok && body.ok === true;
}

function persistLocalSkipRemote() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** 仅用云端数据覆盖内存与本机存档，不触发上传（silent：启动拉取时用，不跳转、不打断） */
function applyRemoteEnvelope(envelope, opts = {}) {
  const silent = opts.silent === true;
  const remote = envelope && envelope.state ? envelope.state : null;
  if (!remote || typeof remote !== 'object') return false;
  const merged = { ...defaultState(), ...remote };
  merged.savedAt = normalizeSavedAt(
    envelope.savedAt != null ? envelope.savedAt : merged.savedAt
  );
  state = merged;
  persistLocalSkipRemote();
  applyUiFontScaleFromState();
  if (!silent) toast('已从云端更新', 'success');
  if (!silent) navigate(currentPage === 'dailyEdit' ? 'dashboard' : currentPage);
  return true;
}

function scheduleRemotePush() {
  const cfg = getSyncConfig();
  if (!cfg.baseUrl || !cfg.token) return;
  if (_remotePushTimer) clearTimeout(_remotePushTimer);
  _remotePushTimer = setTimeout(async () => {
    _remotePushTimer = null;
    try {
      await syncPushFullState();
    } catch (e) {
      console.warn('云端同步推送失败:', e);
    }
  }, CLOUD_DEBOUNCE_MS);
}

/** 立即上传（用于「覆盖云端」按钮，避免等待防抖） */
async function flushRemotePushNow() {
  const cfg = getSyncConfig();
  if (!cfg.baseUrl || !cfg.token) return false;
  if (_remotePushTimer) {
    clearTimeout(_remotePushTimer);
    _remotePushTimer = null;
  }
  return syncPushFullState();
}

/**
 * 若云端存档较新则静默覆盖本机（与「从云端下载」相同合并规则，无弹窗）。
 * 在「编辑当日」页跳过，以免覆盖未点保存的表单。
 */
async function maybeApplyRemoteIfNewer(opts = {}) {
  const rerender = opts.rerender !== false;
  const logErrors = opts.logErrors !== false;
  const toastOnApply = opts.toastOnApply === true;
  const cfg = getSyncConfig();
  if (!cfg.baseUrl || !cfg.token) return false;
  if (currentPage === 'dailyEdit') return false;
  try {
    const env = await syncPullFromRemote();
    if (!env) return false;
    const rs = normalizeSavedAt(env.savedAt != null ? env.savedAt : env.state.savedAt);
    const ls = normalizeSavedAt(state.savedAt);
    if (rs <= ls) return false;
    applyRemoteEnvelope(env, { silent: true });
    if (rerender) rerenderCurrentPage();
    if (toastOnApply) toast('已从云端同步较新数据', 'success');
    return true;
  } catch (e) {
    if (logErrors && localStorage.getItem(STORAGE_KEY)) console.warn('云端拉取跳过:', e);
    return false;
  }
}

async function bootstrapCloudPullOnce() {
  await maybeApplyRemoteIfNewer({ rerender: false, logErrors: true, toastOnApply: false });
}

function scheduleCloudAutoPullDebounced() {
  if (_cloudVisibilityPullTimer) clearTimeout(_cloudVisibilityPullTimer);
  _cloudVisibilityPullTimer = setTimeout(() => {
    _cloudVisibilityPullTimer = null;
    void maybeApplyRemoteIfNewer({ rerender: true, logErrors: false, toastOnApply: true });
  }, CLOUD_VISIBILITY_PULL_DELAY_MS);
}

function cloudVisibilityChangeHandler() {
  if (document.visibilityState === 'visible') scheduleCloudAutoPullDebounced();
}

function cloudPageshowHandler() {
  scheduleCloudAutoPullDebounced();
}

function stopCloudAutoPull() {
  if (_cloudAutoPullIntervalId) {
    clearInterval(_cloudAutoPullIntervalId);
    _cloudAutoPullIntervalId = null;
  }
  if (_cloudVisibilityPullTimer) {
    clearTimeout(_cloudVisibilityPullTimer);
    _cloudVisibilityPullTimer = null;
  }
  document.removeEventListener('visibilitychange', cloudVisibilityChangeHandler);
  window.removeEventListener('pageshow', cloudPageshowHandler);
}

/** 在已填写同步地址与同步码时启用：定时 + 切回前台时拉取较新云端存档 */
function startCloudAutoPull() {
  stopCloudAutoPull();
  const cfg = getSyncConfig();
  if (!cfg.baseUrl || !cfg.token) return;
  document.addEventListener('visibilitychange', cloudVisibilityChangeHandler);
  window.addEventListener('pageshow', cloudPageshowHandler);
  _cloudAutoPullIntervalId = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    void maybeApplyRemoteIfNewer({ rerender: true, logErrors: false, toastOnApply: true });
  }, CLOUD_AUTO_PULL_INTERVAL_MS);
}

async function testSyncConnection(baseUrlInput, tokenInput) {
  const u = trimSyncUrl(baseUrlInput);
  const t = (tokenInput || '').trim();
  if (!u || !t) throw new Error('请先填写云端地址与同步码');
  const probe = trimSyncUrl(u);
  const url = `${probe}/api/health-sync`;
  const res = await fetch(url, {
    cache: 'no-store',
    method: 'GET',
    headers: { Authorization: `Bearer ${t}` },
  });
  const text = await res.text().catch(() => '');
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch (_) {}
  if (res.status === 401) throw new Error('同步码不正确');
  if (res.status === 503) throw new Error(body.error || '服务器未启用同步');
  if (res.status >= 400) throw new Error(body.error || `HTTP ${res.status}`);
  return true;
}

function getAllClinics() {
  const custom = (state.customClinics || []).map(c => ({
    key: c.key, label: c.label, emoji: c.emoji || '🏥', custom: true
  }));
  // Built-in clinics first, then custom, with "其他" last
  const builtin = CLINICS.filter(c => c.key !== '其他');
  const other   = CLINICS.find(c => c.key === '其他');
  return [...builtin, ...custom, other];
}

function findClinic(key) {
  return getAllClinics().find(c => c.key === key) || { emoji: '🏥', label: key };
}

function getAllPainParts() {
  const custom = (state.customPainParts || []).map(p => ({
    key: p.key, label: p.label, emoji: p.emoji || '🤕', custom: true
  }));
  return [...PAIN_PARTS, ...custom];
}

function findPainPart(key) {
  return getAllPainParts().find(p => p.key === key) || { key, label: key, emoji: '🤕' };
}

function getAllMedItems() {
  const custom = (state.customMedItems || []).map(m => ({
    key: m.key, label: m.label, custom: true
  }));
  return [...MEDICATIONS, ...custom];
}

function findMedItem(key) {
  return getAllMedItems().find(m => m.key === key) || { key, label: key };
}

function getAllInsurers() {
  const custom = (state.customInsurers || []).map(i => ({
    key: i.key, label: i.label, custom: true
  }));
  return [...INSURERS, ...custom];
}

function findInsurer(key) {
  return getAllInsurers().find(i => i.key === key) || { key, label: key };
}

const FONT_SCALE_IDS = ['standard', 'large', 'xlarge'];

function fontScaleShortLabel(fs) {
  if (fs === 'large') return '大一点';
  if (fs === 'xlarge') return '再大一点';
  return '标准';
}

function applyUiFontScaleFromState() {
  const p = FONT_SCALE_IDS.includes(state.uiFontScale) ? state.uiFontScale : 'standard';
  document.documentElement.setAttribute('data-font-scale', p);
}

let state = loadState();
applyUiFontScaleFromState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch (e) {
    console.error('Failed to load state', e);
    return defaultState();
  }
}

function saveState() {
  state.savedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleRemotePush();
}

/**
 * 首次打开且本机尚无存档时，尝试拉取同目录下的 seed-data.json（与「导出 JSON」格式相同），
 * 用于部署后新手机一打开就有历史数据（不必再手导 Excel）。
 * 若仓库无此文件或为空，则静默跳过。
 */
async function tryApplyBundledSeedIfFresh() {
  if (localStorage.getItem(STORAGE_KEY)) return false;
  try {
    const res = await fetch('./seed-data.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data || typeof data !== 'object') return false;
    const merged = { ...defaultState(), ...data };
    const has =
      (merged.daily && merged.daily.length > 0) ||
      (merged.visits && merged.visits.length > 0) ||
      (merged.vaccines && merged.vaccines.length > 0) ||
      (merged.claims && merged.claims.length > 0);
    if (!has) return false;
    state = merged;
    saveState();
    return true;
  } catch (e) {
    console.warn('seed-data.json skipped:', e);
    return false;
  }
}

/* ---------- 3b. 每日寄语引擎（种子随机 + 组合拳 + 自建句子） ---------- */
let _encOffset = 0;

function _dayIndexLocal() {
  const d = new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

/** 确定性 PRNG：同一天 + 同一时段 + 同一换句偏移 → 可复现的一条；换句点“换一句”会真正变样 */
function _mulberry32(seed) {
  let a = seed >>> 0;
  return function rnd() {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _encSeed() {
  const d = new Date();
  const day = _dayIndexLocal();
  const band = d.getHours() < 11 ? 0 : d.getHours() < 17 ? 1 : 2;
  const ymd =
    ((d.getFullYear() % 3000) * 372) +
    ((d.getMonth() + 1) * 31) +
    d.getDate();
  let seed = ((((day * 1103515245 + ymd * 7919 + band * 83492791) ^
    (_encOffset * 2654435761)) >>> 0));
  return seed === 0 ? 0x9e3779b9 : seed;
}

function _randPick(arr, rnd) {
  if (!arr || !arr.length) return '';
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}

function buildCompositeEncouragement(rnd) {
  const p = _randPick(ENC_CMP_PREFIX, rnd);
  const k = _randPick(ENC_CMP_KERNEL, rnd);
  const t = _randPick(ENC_CMP_TAIL, rnd);
  let s = p + k;
  if (t && rnd() > 0.35) {
    const join = rnd() > 0.5 ? '' : ' ';
    s += (s.endsWith('。') ? join : '') + t;
    if (!s.endsWith('。') && !s.endsWith('！') && !s.endsWith('？')) s += '。';
  } else if (s && !s.endsWith('。') && !s.endsWith('！') && !s.endsWith('？')) {
    s += '。';
  }
  return s.replace(/\。\。/g, '。').trim();
}

function getDailyEncouragement() {
  const customs = Array.isArray(state.customEncouragements)
    ? state.customEncouragements.map(x => String(x).trim()).filter(Boolean)
    : [];
  const pool = [...ENCOURAGEMENT_CORE, ...customs];

  let rnd = _mulberry32(_encSeed());

  let line = '';

  /* 低频掺一句季节碎碎念（不改变“今日主句”，多数时候合并到组合句里太难，这里单独加权）*/
  const seasonMix = rnd() < 0.085;
  const seasonTxt = seasonMix ? _randPick(ENC_SEASON_NOTE, rnd) : '';

  const mode = rnd();
  /* ~42% 组合拳 | ~53% 直出核心句池 | ~5% 仅用自建（若自建非空），提高自建存在感 */
  if (customs.length && mode < 0.05) {
    line = _randPick(customs, rnd);
  } else if (mode < 0.47 || pool.length < 40) {
    line = buildCompositeEncouragement(rnd);
    if (!(line.length > 14)) line = _randPick(pool, rnd);
  } else {
    line = _randPick(pool, rnd);
  }

  if (seasonTxt && rnd() > 0.58) {
    line = `${line}${line.endsWith('。') ? '' : '。'}${seasonTxt}`;
  }

  return line || _randPick(ENCOURAGEMENT_CORE, rnd);
}

/* ---------- 4. CRUD HELPERS ---------- */

function upsert(collection, record) {
  const list = state[collection];
  const idx = list.findIndex(x => x.id === record.id);
  if (idx >= 0) list[idx] = record; else list.push(record);
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  saveState();
}

function removeById(collection, id) {
  state[collection] = state[collection].filter(x => x.id !== id);
  saveState();
}

function getDailyByDate(date) {
  return state.daily.find(d => d.date === date);
}

/* ---------- 5. ROUTING ---------- */

const pages = {
  dashboard:   { title: '张婷要健康！', subtitle: '健康概览',     icon: '🏠', render: renderDashboard },
  daily:       { title: '每日记录', subtitle: '身体状况 · 摘要',  icon: '✏️', render: renderDailyList },
  dailyEdit:   { title: '记录',     subtitle: '编辑当日',         icon: '✏️', render: renderDailyEdit },
  vaccines:    { title: '疫苗',     subtitle: '接种记录',         icon: '💉', render: renderVaccines },
  visits:      { title: '看诊',     subtitle: '各科就诊',         icon: '🏥', render: renderVisits },
  claims:      { title: '理赔',     subtitle: '保险报销',         icon: '📑', render: renderClaims },
  analytics:   { title: '分析',     subtitle: '身体状况趋势',     icon: '📊', render: renderAnalytics },
  more:        { title: '更多',     subtitle: '数据 · 设置',      icon: '📋', render: renderMore },
  search:      { title: '搜索',     subtitle: '检索所有记录',     icon: '🔍', render: renderSearch },
};

let currentPage = 'dashboard';
let currentContext = {};

/** 自动从云端合并后刷新当前页（不切页、不关弹窗） */
function rerenderCurrentPage() {
  const meta = pages[currentPage];
  if (!meta) return;
  const container = $('#pageContainer');
  container.innerHTML = '';
  meta.render(container, currentContext);
}

/** 首页内导航时带上简报展开状态 + 热力图月视图上下文 */
function mergeDashboardCtx(patch = {}) {
  const o = {};
  if (currentContext.briefingOpen) o.briefingOpen = true;
  if (currentContext.heatmapMode === 'month' && currentContext.heatmapMonth) {
    o.heatmapMode = 'month';
    o.heatmapMonth = { ...currentContext.heatmapMonth };
  }
  const out = { ...o, ...patch };
  if (patch.compactHeatmap) {
    delete out.heatmapMode;
    delete out.heatmapMonth;
    delete out.compactHeatmap;
  }
  return out;
}

function navigate(page, context = {}, navOpts = {}) {
  if (!pages[page]) {
    console.warn('Unknown page', page);
    return;
  }
  /* Flatpickr 把日历插在 body 上且 z-index 很高；销毁页面表单时若不清理会挡住后续界面（像弹窗关不掉）。 */
  closeModal();
  currentPage = page;
  currentContext = context;
  const meta = pages[page];
  $('#pageTitle').textContent = meta.title;
  $('#pageSubtitle').textContent = meta.subtitle;
  const hm = document.getElementById('headerMark');
  if (hm) {
    hm.replaceChildren();
    if (page === 'dashboard') {
      const img = document.createElement('img');
      img.src = 'icons/pwa-192.jpeg';
      img.alt = '';
      img.className = 'absolute inset-0 h-full w-full object-cover object-[center_top]';
      img.decoding = 'async';
      hm.appendChild(img);
    } else {
      hm.textContent = meta.icon || '🏠';
    }
  }
  const container = $('#pageContainer');
  container.innerHTML = '';
  meta.render(container, context);
  // Update bottom nav active state
  $$('.nav-btn').forEach(btn => {
    const key = btn.dataset.page;
    btn.classList.toggle('active',
      (key === page) ||
      (key === 'dashboard' && page === 'analytics') ||
      (key === 'visits'    && page === 'visitEdit') ||
      (key === 'more'      && ['vaccines','claims','search'].includes(page))
    );
  });
  if (!navOpts.keepScroll) {
    window.scrollTo(0, 0);
  }
}

/** 首页内「软刷新」（热力图/简报折叠等）：不切页时不要滚回顶部 */
function navigateDashboardPreserveScroll(patch = {}) {
  navigate('dashboard', mergeDashboardCtx(patch), { keepScroll: true });
}

/* ---------- 6. PAGE: DASHBOARD ---------- */

/** 热力图年月快选：年份范围 = 档案里最早～最晚年份，并上下各留少许空档 */
function getHeatmapYearPickerSpan() {
  const now = new Date();
  let low = now.getFullYear();
  let high = now.getFullYear();
  const take = (iso) => {
    if (!iso || typeof iso !== 'string' || iso.length < 4) return;
    const y = parseInt(iso.slice(0, 4), 10);
    if (Number.isFinite(y)) {
      low = Math.min(low, y);
      high = Math.max(high, y);
    }
  };
  (state.daily || []).forEach(d => take(d.date));
  (state.visits || []).forEach(v => take(v.date));
  (state.vaccines || []).forEach(v => take(v.date));
  (state.claims || []).forEach(c => take(c.date));
  low = Math.min(low, now.getFullYear() - 15);
  high = Math.max(high, now.getFullYear() + 2);
  if (low > high) low = high = now.getFullYear();
  return { low, high };
}

function renderDashboard(container, ctx = {}) {
  const today = todayStr();

  // Recent 30 days
  const last30 = state.daily.filter(d => daysBetween(d.date, today) <= 30 && daysBetween(d.date, today) >= 0);
  const headacheDays = last30.filter(d => (d.pains?.headache || 0) > 0).length;
  const medsDays     = last30.filter(d =>
    Object.values(d.meds || {}).some(Boolean) || (d.customMeds && d.customMeds.length)
  ).length;
  const visitCount30 = state.visits.filter(v => daysBetween(v.date, today) <= 30 && daysBetween(v.date, today) >= 0).length;

  // Pending claims total
  const pendingClaims = state.claims.filter(c => c.status !== 'paid' && c.status !== 'denied');
  const pendingAmount = pendingClaims.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const paidAmountYear = state.claims
    .filter(c => c.status === 'paid' && new Date(c.date).getFullYear() === new Date().getFullYear())
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);

  // Last vaccine
  const lastVaccine = state.vaccines[0];

  // Upcoming appointments (~half year ahead)
  const reminders = extractUpcomingReminders(UPCOMING_REMINDER_HORIZON_DAYS);
  const urgent = reminders.filter(r => relativeDayLabel(r.date).tone === 'urgent');
  const visibleReminders = reminders.slice(0, 6);
  const moreCount = Math.max(0, reminders.length - visibleReminders.length);

  const hmMonth = ctx.heatmapMonth && ctx.heatmapMode === 'month' ? ctx.heatmapMonth : null;
  const heatOpts = hmMonth ? { mode: 'month', y: hmMonth.y, m: hmMonth.m } : { mode: 'compact' };
  const calMainTitle = hmMonth ? `${hmMonth.y}年${hmMonth.m}月 · 身体状况` : '近4周 · 痛苦程度（至今日）';

  const nowCal = new Date();
  const pickY = hmMonth ? hmMonth.y : nowCal.getFullYear();
  const pickM = hmMonth ? hmMonth.m : nowCal.getMonth() + 1;
  const spanY = getHeatmapYearPickerSpan();
  const yLow = Math.min(spanY.low, pickY);
  const yHigh = Math.max(spanY.high, pickY);
  const heatmapYearOptions = [];
  for (let yy = yHigh; yy >= yLow; yy--) {
    heatmapYearOptions.push(`<option value="${yy}"${yy === pickY ? ' selected' : ''}>${yy}</option>`);
  }
  const heatmapMonthOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    .map(m => `<option value="${m}"${m === pickM ? ' selected' : ''}>${m}月</option>`)
    .join('');

  const briefingOpen = !!ctx.briefingOpen;
  const hasSavedBrief = typeof state.doctorReportBriefing === 'string' && state.doctorReportBriefing.trim().length > 0;
  const briefingEditorContent = hasSavedBrief ? state.doctorReportBriefing : generateDoctorReportBrief();
  const briefPv = hasSavedBrief
    ? (state.doctorReportBriefing.trim().split(/\n/).find(l => l.trim()) || '已保存草稿').replace(/\s+/g, ' ').slice(0, 48)
    : '点按展开 · 起草见医生时要说的情况';

  container.innerHTML = `
    <!-- Daily encouragement -->
    <section id="encouragementCard" class="encouragement-card p-5">
      <div class="flex items-start justify-between mb-2">
        <div class="flex items-center gap-1.5 text-xs text-rose-700 font-medium">
          <span>🌸</span><span>今日寄语 · 致张婷</span>
        </div>
        <button class="text-xs text-rose-600 hover:text-rose-700 font-medium" data-action="enc-next">换一句 ↻</button>
      </div>
      <div class="text-[15px] leading-relaxed text-slate-800" id="encText">${escapeHtml(getDailyEncouragement())}</div>
      <div class="text-xs text-rose-500/80 mt-3 text-right">— 来自爱你的人 ❤️</div>
    </section>

    ${reminders.length ? `
    <!-- Upcoming appointments -->
    <section class="reminder-card p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5 text-sm font-semibold text-brand-800">
          <span>📅</span><span>即将到来 · 复诊与就医提醒</span>
        </div>
        ${urgent.length ? `<span class="chip" style="background:#fee2e2;color:#b91c1c;border-color:#fecaca">${urgent.length} 项紧急</span>` : ''}
      </div>
      <div class="divide-y divide-brand-100/60">
        ${visibleReminders.map(r => {
          const lbl = relativeDayLabel(r.date);
          const toneCls = lbl.tone === 'urgent' ? 'reminder-urgent'
                        : lbl.tone === 'soon'   ? 'reminder-soon'
                                                : 'reminder-later';
          const sourceLabel = r.kind === 'followUp'   ? '回诊'
                            : r.kind === 'visitNote'  ? '看诊提到'
                                                      : '日记提到';
          const clinicTag = r.clinic ? `${findClinic(r.clinic).emoji} ${escapeHtml(findClinic(r.clinic).label)}` : '';
          const logHint = r.logDateISO
            ? `摘录自 · ${escapeHtml(fmtDate(r.logDateISO))} ${r.sourceKind === 'daily' ? '日记' : '看诊'}`
            : '';
          return `
            <div class="py-2.5 flex items-start gap-3 cursor-pointer hover:bg-brand-500/10 rounded-lg px-2 -mx-2" data-reminder-src="${r.sourceKind}" data-reminder-id="${escapeHtml(String(r.sourceId||''))}" data-reminder-log-date="${escapeHtml(r.logDateISO || '')}" title="点此打开原文记录">
              <div class="reminder-pill ${toneCls}">${escapeHtml(lbl.text)}</div>
              <div class="flex-1 min-w-0">
                <div class="text-[11px] text-brand-600 font-medium mb-0.5">${logHint}${logHint ? ' · ' : ''}点按打开 ›</div>
                <div class="text-sm text-slate-800 line-clamp-3">${escapeHtml(r.text)}</div>
                <div class="flex items-center gap-2 mt-1 text-xs text-slate-500">
                  <span>${sourceLabel}</span>
                  ${clinicTag ? `<span>·</span><span>${clinicTag}</span>` : ''}
                </div>
              </div>
              <span class="text-brand-400 text-lg self-center">›</span>
            </div>
          `;
        }).join('')}
      </div>
      ${moreCount > 0 ? `<div class="text-xs text-slate-400 mt-2 text-center">还有 ${moreCount} 项未显示</div>` : ''}
    </section>
    ` : ''}

    <section class="card p-2.5">
      <button type="button" class="flex w-full items-center gap-2 text-left border-0 bg-transparent p-1.5 rounded-lg hover:bg-slate-50 active:bg-slate-100" data-action="brief-toggle">
        <span class="text-base shrink-0">🩺</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-slate-800">医生汇报草稿</div>
          <div class="text-[11px] text-slate-500 truncate">${escapeHtml(briefPv)}</div>
        </div>
        <span class="text-slate-400 text-sm shrink-0 w-6 text-center">${briefingOpen ? '▲' : '›'}</span>
      </button>
      ${briefingOpen ? `
        <div class="mt-2 pt-2 border-t border-slate-100 space-y-2">
          <p class="text-[11px] text-slate-500">根据本机日记与复诊提醒<strong>离线拼稿</strong>，不是联网 ChatGPT。可自行增删改后保存。</p>
          <textarea id="doctorBriefingTa" class="textarea text-sm leading-relaxed min-h-[12rem]" rows="14">${escapeHtml(briefingEditorContent)}</textarea>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn-primary text-sm py-2" data-action="brief-save">保存草稿</button>
            <button type="button" class="btn-ghost text-sm py-2" data-action="brief-regenerate">重新根据记录起草</button>
          </div>
        </div>
      ` : ''}
    </section>

    <!-- Quick stats grid -->
    <section class="grid grid-cols-2 gap-3">
      <button type="button" class="card p-3 text-left cursor-pointer hover:ring-2 hover:ring-brand-200 transition-shadow border-0 bg-white w-full" data-action="stat30" data-stat-kind="headache">
        <div class="text-xs text-slate-500">近30天 · 头痛（点按看清单）</div>
        <div class="text-2xl font-bold text-rose-600 mt-1">${headacheDays}<span class="text-sm font-normal text-slate-400 ml-1">天</span></div>
      </button>
      <button type="button" class="card p-3 text-left cursor-pointer hover:ring-2 hover:ring-brand-200 transition-shadow border-0 bg-white w-full" data-action="stat30" data-stat-kind="meds">
        <div class="text-xs text-slate-500">近30天 · 用药</div>
        <div class="text-2xl font-bold text-amber-600 mt-1">${medsDays}<span class="text-sm font-normal text-slate-400 ml-1">天</span></div>
      </button>
      <button type="button" class="card p-3 text-left cursor-pointer hover:ring-2 hover:ring-brand-200 transition-shadow border-0 bg-white w-full" data-action="stat30" data-stat-kind="visits">
        <div class="text-xs text-slate-500">近30天 · 看诊</div>
        <div class="text-2xl font-bold text-brand-600 mt-1">${visitCount30}<span class="text-sm font-normal text-slate-400 ml-1">次</span></div>
      </button>
      <button type="button" class="card p-3 text-left cursor-pointer hover:ring-2 hover:ring-brand-200 transition-shadow border-0 bg-white w-full" data-action="stat30" data-stat-kind="claims">
        <div class="text-xs text-slate-500">理赔进行中</div>
        <div class="text-2xl font-bold text-violet-600 mt-1">${pendingClaims.length}<span class="text-sm font-normal text-slate-400 ml-1">单</span></div>
        ${pendingAmount > 0 ? `<div class="text-xs text-slate-400 mt-0.5">约 ${pendingAmount.toLocaleString('zh-CN')} 元</div>` : ''}
      </button>
    </section>

    <!-- Pain calendar -->
    <section class="card p-4">
      <div class="flex items-center gap-2 mb-2">
        <button type="button" class="flex-none w-7 h-7 rounded-md bg-slate-100 text-slate-600 text-sm leading-none hover:bg-brand-100" data-action="hm-nav" data-hm-dir="prev" title="上一月或进入本月月历">◀</button>
        <div class="flex-1 text-center min-w-0">
          <div class="font-semibold text-sm">${calMainTitle}</div>
          ${hmMonth ? `<button type="button" class="text-[11px] text-brand-600 mt-0.5" data-action="hm-compact">回到近4周</button>` : ''}
        </div>
        <button type="button" class="flex-none w-7 h-7 rounded-md bg-slate-100 text-slate-600 text-sm leading-none hover:bg-brand-100" data-action="hm-nav" data-hm-dir="next" title="下一月">▶</button>
        <button type="button" class="text-xs text-brand-600 shrink-0" data-action="goto-analytics">分析→</button>
      </div>
      <div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 mt-1 mb-1.5 px-0.5">
        <span class="text-[11px] text-slate-500 shrink-0">跳到</span>
        <select id="heatmapPickYear" class="heatmap-ym-select rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm min-w-[5.25rem]" title="选择年份">${heatmapYearOptions.join('')}</select>
        <span class="text-[11px] text-slate-400">年</span>
        <select id="heatmapPickMonth" class="heatmap-ym-select rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm min-w-[4.75rem]" title="选择月份">${heatmapMonthOptions}</select>
      </div>
      <div class="heatmap-dashboard-wrap">
      ${renderHeatmap(heatOpts)}
      </div>
      <div class="flex flex-wrap items-center gap-1 mt-3 text-xs text-slate-400">
        <span>浅色→深</span>
        <span class="pain-pill pain-0">无</span>
        <span class="pain-pill pain-3">3</span>
        <span class="pain-pill pain-6">6</span>
        <span class="pain-pill pain-9">9</span>
        <span>最重痛苦</span>
      </div>
    </section>

    <!-- Recent visits -->
    <section class="card p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="font-semibold text-sm">最近看诊</div>
        <button class="text-xs text-brand-600" data-action="goto-visits">查看全部 →</button>
      </div>
      ${state.visits.slice(0, 3).map(v => `
        <div class="py-2 border-b border-slate-100 last:border-0 cursor-pointer" data-action="edit-visit" data-id="${v.id}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-lg">${findClinic(v.clinic).emoji}</span>
              <span class="font-medium text-sm">${escapeHtml(findClinic(v.clinic).label || v.clinic || '其他')}</span>
              ${v.doctor ? `<span class="text-xs text-slate-400">· ${escapeHtml(v.doctor)}</span>` : ''}
            </div>
            <div class="text-xs text-slate-400">${fmtDate(v.date)}</div>
          </div>
          ${v.summary ? `<div class="text-xs text-slate-500 mt-1 pl-7 line-clamp-2">${escapeHtml(v.summary)}</div>` : ''}
        </div>
      `).join('') || `<div class="text-sm text-slate-400 py-2">还没有看诊记录</div>`}
    </section>

    <!-- Insurance summary -->
    <section class="card p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="font-semibold text-sm">保险理赔</div>
        <button class="text-xs text-brand-600" data-action="goto-claims">查看全部 →</button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <div class="text-xs text-slate-500">今年已到账</div>
          <div class="text-xl font-semibold text-green-600 mt-1">${paidAmountYear.toLocaleString('zh-CN')}<span class="text-xs font-normal text-slate-400 ml-1">元</span></div>
        </div>
        <div>
          <div class="text-xs text-slate-500">待跟进</div>
          <div class="text-xl font-semibold text-amber-600 mt-1">${pendingClaims.length}<span class="text-xs font-normal text-slate-400 ml-1">单</span></div>
        </div>
      </div>
    </section>

    <!-- Last vaccine + Add vaccine -->
    <section class="card p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="font-semibold text-sm">疫苗</div>
        <button class="text-xs text-brand-600" data-action="goto-vaccines">查看全部 →</button>
      </div>
      ${lastVaccine ? `
        <div class="text-sm">
          <div class="flex items-center justify-between">
            <span class="font-medium">${escapeHtml(lastVaccine.name)}</span>
            <span class="text-xs text-slate-400">${fmtDate(lastVaccine.date)}</span>
          </div>
          ${lastVaccine.duration ? `<div class="text-xs text-slate-500 mt-1">效期：${escapeHtml(lastVaccine.duration)}</div>` : ''}
        </div>
      ` : `<div class="text-sm text-slate-400 py-2">还没有疫苗记录</div>`}
    </section>
  `;

  bindDashboardClickDelegationOnce();
}

/** pageContainer 上只绑一次委派，避免因每次 renderDashboard 重复 addListener 导致一次点击触发多遍（热力图箭头会一月跳两级）*/
let dashboardClickDelegationBound = false;
function bindDashboardClickDelegationOnce() {
  if (dashboardClickDelegationBound) return;
  dashboardClickDelegationBound = true;
  const root = $('#pageContainer');
  root.addEventListener('click', onDashboardPageContainerClick);
  root.addEventListener('change', onDashboardHeatmapYmChange);
}

function onDashboardHeatmapYmChange(e) {
  if (currentPage !== 'dashboard') return;
  const t = e.target;
  if (!t || (t.id !== 'heatmapPickYear' && t.id !== 'heatmapPickMonth')) return;
  const root = $('#pageContainer');
  const ys = root.querySelector('#heatmapPickYear');
  const ms = root.querySelector('#heatmapPickMonth');
  if (!ys || !ms) return;
  const y = parseInt(ys.value, 10);
  const m = parseInt(ms.value, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return;
  navigateDashboardPreserveScroll({
    heatmapMode: 'month',
    heatmapMonth: { y, m },
  });
}

function onDashboardPageContainerClick(e) {
  if (currentPage !== 'dashboard') return;

  const root = $('#pageContainer');
  const today = todayStr();

  const dayCell = e.target.closest('[data-action="open-day"]');
  if (dayCell) {
    openDayDetailModal(dayCell.dataset.date);
    return;
  }

  const remRow = e.target.closest('[data-reminder-src]');
  if (remRow) {
    const src = remRow.dataset.reminderSrc;
    const id  = remRow.dataset.reminderId;
    if (src === 'visit') openVisitEditor(id);
    else if (src === 'daily') {
      const dt = remRow.dataset.reminderLogDate;
      if (dt) navigate('dailyEdit', { date: dt });
      else toast('找不到原文日期', 'error');
    }
    return;
  }

  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
  if (action === 'edit-today')      navigate('dailyEdit', { date: today });
  if (action === 'goto-visits')     navigate('visits');
  if (action === 'goto-claims')     navigate('claims');
  if (action === 'goto-vaccines')   navigate('vaccines');
  if (action === 'goto-analytics')  navigate('analytics');
  if (action === 'edit-visit')      openVisitEditor(t.dataset.id);
  if (action === 'stat30') {
    openLast30StatSummary(t.dataset.statKind);
    return;
  }
  if (action === 'hm-compact') {
    navigateDashboardPreserveScroll({ compactHeatmap: true });
    return;
  }
  if (action === 'hm-nav') {
    const dir = t.dataset.hmDir;
    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth() + 1;
    if (dir === 'prev') {
      if (currentContext.heatmapMode === 'month' && currentContext.heatmapMonth) {
        navigateDashboardPreserveScroll({
          heatmapMode: 'month',
          heatmapMonth: _monthPrev(currentContext.heatmapMonth.y, currentContext.heatmapMonth.m),
        });
      } else {
        navigateDashboardPreserveScroll({ heatmapMode: 'month', heatmapMonth: { y: cy, m: cm } });
      }
    } else if (dir === 'next') {
      if (currentContext.heatmapMode === 'month' && currentContext.heatmapMonth) {
        navigateDashboardPreserveScroll({
          heatmapMode: 'month',
          heatmapMonth: _monthNext(currentContext.heatmapMonth.y, currentContext.heatmapMonth.m),
        });
      } else {
        navigateDashboardPreserveScroll({ heatmapMode: 'month', heatmapMonth: _monthNext(cy, cm) });
      }
    }
    return;
  }

  if (action === 'brief-toggle') {
    navigateDashboardPreserveScroll({ briefingOpen: !currentContext.briefingOpen });
    return;
  }
  if (action === 'brief-save') {
    const ta = root.querySelector('#doctorBriefingTa');
    state.doctorReportBriefing = ta ? String(ta.value) : '';
    saveState();
    toast('草稿已保存', 'success');
    return;
  }
  if (action === 'brief-regenerate') {
    const ta = root.querySelector('#doctorBriefingTa');
    const savedTrim = typeof state.doctorReportBriefing === 'string' && state.doctorReportBriefing.trim().length > 0;
    const expectedInTa = savedTrim ? state.doctorReportBriefing : generateDoctorReportBrief();
    const dirty = ta && ta.value !== expectedInTa;
    const go = !dirty || confirm('将用当前档案重新起草正文；未保存的修改会丢掉。要继续吗？');
    if (!go) return;
    state.doctorReportBriefing = generateDoctorReportBrief();
    saveState();
    navigateDashboardPreserveScroll({ briefingOpen: true });
    return;
  }

  if (action === 'enc-next') {
    _encOffset++;
    const el = document.getElementById('encText');
    if (el) {
      el.style.transition = 'opacity 0.18s';
      el.style.opacity = '0';
      setTimeout(() => {
        el.textContent = getDailyEncouragement();
        el.style.opacity = '1';
      }, 180);
    }
  }
}

function openDayDetailModal(dateISO) {
  const log = getDailyByDate(dateISO);
  const dt = _atMidnight(new Date(dateISO));
  const today = _atMidnight(new Date());
  const isFuture = dt > today;
  const isToday  = dt.getTime() === today.getTime();

  let body;
  const hasAny = log && (
    Object.keys(log.pains || {}).length ||
    Object.keys(log.meds || {}).length  ||
    (log.customMeds && log.customMeds.length) ||
    log.summary || log.bowel
  );

  if (!log || !hasAny) {
    body = `
      <div class="text-center py-8 text-slate-500">
        <div class="text-4xl mb-3">${isFuture ? '⏳' : (isToday ? '✨' : '📋')}</div>
        <div class="text-sm">${isFuture ? '这天还没到' : (isToday ? '今天还没有记录' : '这天没有记录')}</div>
      </div>
    `;
  } else {
    // Also surface any visits / vaccines / claims on that day for context
    const dayVisits   = state.visits.filter(v => v.date === dateISO);
    const dayVaccines = state.vaccines.filter(v => v.date === dateISO);
    const dayClaims   = state.claims.filter(c => c.date === dateISO);

    body = `
      <div class="space-y-3">
        ${renderDailySummary(log)}
        ${dayVisits.length ? `
          <div class="pt-2 border-t border-slate-100">
            <div class="text-xs font-semibold text-slate-500 mb-1.5">当日看诊</div>
            ${dayVisits.map(v => `
              <div class="flex items-start gap-2 text-sm py-1">
                <span>${findClinic(v.clinic).emoji}</span>
                <div class="flex-1 min-w-0">
                  <div class="font-medium">${escapeHtml(findClinic(v.clinic).label)}${v.doctor ? ' · ' + escapeHtml(v.doctor) : ''}</div>
                  ${v.summary ? `<div class="text-xs text-slate-500 mt-0.5">${escapeHtml(v.summary)}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${dayVaccines.length ? `
          <div class="pt-2 border-t border-slate-100">
            <div class="text-xs font-semibold text-slate-500 mb-1.5">当日疫苗</div>
            ${dayVaccines.map(v => `<div class="text-sm">💉 ${escapeHtml(v.name)}${v.dose ? ' · ' + escapeHtml(v.dose) : ''}</div>`).join('')}
          </div>
        ` : ''}
        ${dayClaims.length ? `
          <div class="pt-2 border-t border-slate-100">
            <div class="text-xs font-semibold text-slate-500 mb-1.5">当日理赔</div>
            ${dayClaims.map(c => `<div class="text-sm">📑 ${escapeHtml(findInsurer(c.insurer).label || c.insurer)} · ${Number(c.amount||0).toLocaleString('zh-CN')} 元</div>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  const buttons = [];
  if (!isFuture) {
    buttons.push({
      label: log ? '编辑' : '添加记录',
      class: 'btn-primary',
      onClick: () => { closeModal(); navigate('dailyEdit', { date: dateISO }); }
    });
  }
  buttons.push({ label: '关闭', class: 'btn-ghost', onClick: closeModal });

  openModal(fmtDateLong(dateISO), body, buttons);
}

function renderDailySummary(log) {
  const painList = getAllPainParts()
    .filter(p => (log.pains?.[p.key] || 0) > 0)
    .map(p => `<span class="chip is-on">${p.emoji} ${escapeHtml(p.label)} <span class="${painClass(log.pains[p.key])} ml-1">${log.pains[p.key]}</span></span>`);
  const meds = getAllMedItems().filter(m => log.meds?.[m.key]).map(m => `<span class="chip is-on">💊 ${escapeHtml(m.label)}</span>`);
  const customMeds = (log.customMeds || []).map(m => `<span class="chip is-on">💊 ${escapeHtml(m)}</span>`);
  return `
    <div class="space-y-2">
      ${painList.length || meds.length || customMeds.length ? `
        <div class="flex flex-wrap gap-1.5">
          ${painList.join('')}${meds.join('')}${customMeds.join('')}
        </div>
      ` : ''}
      ${log.summary ? `<div class="text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(log.summary)}</div>` : ''}
      ${log.bowel ? `<div class="text-xs text-slate-500">💩 大便：${escapeHtml(log.bowel)}</div>` : ''}
    </div>
  `;
}

/** 痛苦日历：compact=近4周（不显示今天之后的日期）；month=按月（可含未来） */
function renderHeatmap(opts = { mode: 'compact' }) {
  const today = _atMidnight(new Date());
  const weekdays = ['一','二','三','四','五','六','日'];
  const cells = [];

  function oneCell(d, iso, isFuture, isToday) {
    const log = getDailyByDate(iso);
    const maxPain = log ? Math.max(0, ...Object.values(log.pains || {})) : 0;
    let tip = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
    if (log) {
      const parts = getAllPainParts()
        .filter(p => (log.pains?.[p.key] || 0) > 0)
        .map(p => `${p.label} ${log.pains[p.key]}度`);
      tip += parts.length ? '\n' + parts.join('、') : '\n无疼痛记录（已写其它字段）';
    } else if (isFuture) {
      tip += '（未到）';
    } else {
      tip += '\n点开可补记当日';
    }
    let cls = 'heatmap-cell';
    if (isFuture) {
      cls += ' is-future';
    } else if (maxPain > 0) {
      cls += ' has-data pain-' + Math.round(maxPain);
    } else {
      cls += ' is-past-empty';
    }
    if (isToday) cls += ' is-today';
    return `
      <div class="${cls}"
           title="${escapeHtml(tip)}"
           data-action="open-day" data-date="${iso}">
        ${d.getDate()}
      </div>
    `;
  }

  if (opts.mode === 'month') {
    const y = opts.y;
    const m = opts.m; /* 1–12 */
    const first = new Date(y, m - 1, 1);
    const lastDom = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    for (let i = 0; i < lead; i++) {
      cells.push('<div class="heatmap-cell heatmap-cell-pad" aria-hidden="true"></div>');
    }
    for (let dom = 1; dom <= lastDom; dom++) {
      const d = _atMidnight(new Date(y, m - 1, dom));
      const iso = d.toISOString().slice(0, 10);
      const isFuture = d > today;
      const isToday = d.getTime() === today.getTime();
      cells.push(oneCell(d, iso, isFuture, isToday));
    }
    const total = lead + lastDom;
    const padEnd = (7 - (total % 7)) % 7;
    for (let i = 0; i < padEnd; i++) {
      cells.push('<div class="heatmap-cell heatmap-cell-pad" aria-hidden="true"></div>');
    }
  } else {
    /* 紧凑：从今天往回约4周；只渲染 ≤ 今天的格子，右侧用透明占位补齐整行 */
    const end = today;
    let start = _addDays(end, -27);
    while (start.getDay() !== 1) start = _addDays(start, -1);
    for (let d = new Date(start); d <= end; d = _addDays(d, 1)) {
      const dd = _atMidnight(d);
      const iso = dd.toISOString().slice(0, 10);
      const isToday = dd.getTime() === today.getTime();
      cells.push(oneCell(dd, iso, false, isToday));
    }
    const n = cells.length;
    const padEnd = (7 - (n % 7)) % 7;
    for (let i = 0; i < padEnd; i++) {
      cells.push('<div class="heatmap-cell heatmap-cell-pad" aria-hidden="true"></div>');
    }
  }

  return `
    <div class="heatmap-wd-row">
      ${weekdays.map(w => `<div class="heatmap-wd">${w}</div>`).join('')}
    </div>
    <div class="heatmap">${cells.join('')}</div>
  `;
}

/** 月度导航 helpers */
function _monthPrev(y, m) {
  const d = new Date(y, m - 2, 1); /* m 1-based -> subtract 2 for prev month JS */
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}
function _monthNext(y, m) {
  const d = new Date(y, m, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function openLast30StatSummary(stat) {
  const todayISO = todayStr();
  const in30daily = state.daily
    .filter(d => d.date && daysBetween(d.date, todayISO) <= 30 && daysBetween(d.date, todayISO) >= 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  let title = '';
  let subtitle = '';
  let rowsHtml = '';

  if (stat === 'headache') {
    title = '近30天 · 有头痛的日子';
    const rows = in30daily.filter(d => (d.pains?.headache || 0) > 0);
    subtitle = `共 ${rows.length} 天 · 点此打开当日详情`;
    rowsHtml = rows.length ? rows.map(d => `
      <button type="button" class="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex flex-col gap-1 heat-stat-row" data-detail-date="${d.date}">
        <div class="flex justify-between gap-2">
          <span class="font-semibold text-sm">${escapeHtml(fmtDate(d.date))}</span>
          <span class="${painClass(d.pains?.headache || 0)} text-xs">${d.pains?.headache || 0} 度</span>
        </div>
        ${d.summary ? `<div class="text-xs text-slate-600 line-clamp-3">${escapeHtml(d.summary)}</div>` : '<div class="text-xs text-slate-400">无摘要</div>'}
      </button>
    `).join('') : '<div class="p-6 text-center text-slate-400 text-sm">这30天内没有记录头痛的日子</div>';
  } else if (stat === 'meds') {
    title = '近30天 · 有用药记录的日子';
    const rows = in30daily.filter(d =>
      Object.values(d.meds || {}).some(Boolean) ||
      (d.customMeds && d.customMeds.length)
    );
    subtitle = `共 ${rows.length} 天`;
    rowsHtml = rows.length ? rows.map(d => {
      const names = [
        ...getAllMedItems().filter(m => d.meds?.[m.key]).map(m => m.label),
        ...(d.customMeds || [])
      ];
      return `
      <button type="button" class="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 heat-stat-row" data-detail-date="${d.date}">
        <div class="font-semibold text-sm mb-1">${escapeHtml(fmtDate(d.date))}</div>
        <div class="text-xs text-slate-600">${escapeHtml(names.join('、') || '（已勾选）')}</div>
        ${d.summary ? `<div class="text-xs text-slate-500 mt-1 line-clamp-2">${escapeHtml(d.summary)}</div>` : ''}
      </button>`;
    }).join('') : '<div class="p-6 text-center text-slate-400 text-sm">这30天内没有勾选用药</div>';
  } else if (stat === 'visits') {
    title = '近30天 · 看诊记录';
    const rows = state.visits
      .filter(v => v.date && daysBetween(v.date, todayISO) <= 30 && daysBetween(v.date, todayISO) >= 0)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    subtitle = `共 ${rows.length} 次`;
    rowsHtml = rows.length ? rows.map(v => `
      <button type="button" class="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 heat-stat-visit" data-visit-id="${v.id}">
        <div class="flex justify-between gap-2">
          <span class="font-semibold text-sm">${escapeHtml(findClinic(v.clinic).label)}</span>
          <span class="text-xs text-slate-400">${escapeHtml(fmtDate(v.date))}</span>
        </div>
        ${v.summary ? `<div class="text-xs text-slate-600 mt-1 line-clamp-2">${escapeHtml(v.summary)}</div>` : ''}
      </button>
    `).join('') : '<div class="p-6 text-center text-slate-400 text-sm">这30天内没有看诊</div>';
  } else if (stat === 'claims') {
    title = '理赔 · 待跟进';
    const rows = state.claims.filter(c => c.status !== 'paid' && c.status !== 'denied')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    subtitle = `共 ${rows.length} 单`;
    rowsHtml = rows.length ? rows.map(c => `
      <button type="button" class="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 heat-stat-claim" data-claim-id="${c.id}">
        <div class="flex justify-between gap-2">
          <span class="font-semibold text-sm">${escapeHtml(findInsurer(c.insurer).label || c.insurer)}</span>
          <span class="text-amber-700 font-semibold">${Number(c.amount || 0).toLocaleString('zh-CN')} 元</span>
        </div>
        <div class="text-xs text-slate-500 mt-1">${escapeHtml(c.type || '')} · ${escapeHtml(fmtDate(c.date))}</div>
      </button>
    `).join('') : '<div class="p-6 text-center text-slate-400 text-sm">没有进行中的理赔</div>';
  }

  openModal(title, `
    <p class="text-xs text-slate-500 mb-2">${escapeHtml(subtitle)}</p>
    <div class="max-h-[60vh] overflow-y-auto -mx-1 border border-slate-100 rounded-lg">${rowsHtml}</div>
  `, [{ label: '关闭', class: 'btn-primary', onClick: closeModal }]);

  setTimeout(() => {
    const panel = document.querySelector('.modal-panel > div.overflow-y-auto');
    if (!panel) return;
    panel.querySelectorAll('.heat-stat-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const dt = btn.dataset.detailDate;
        closeModal();
        openDayDetailModal(dt);
      });
    });
    panel.querySelectorAll('.heat-stat-visit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.visitId;
        closeModal();
        openVisitEditor(id);
      });
    });
    panel.querySelectorAll('.heat-stat-claim').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.claimId;
        closeModal();
        openClaimEditor(id);
      });
    });
  }, 0);
}

/* ---------- 7. PAGE: DAILY LIST ---------- */

function renderDailyList(container) {
  const months = {};
  state.daily.forEach(d => {
    const m = (d.date || '').slice(0, 7);
    if (!months[m]) months[m] = [];
    months[m].push(d);
  });
  const sortedMonths = Object.keys(months).sort().reverse();

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-500">共 ${state.daily.length} 条记录</div>
      <button class="btn-primary" data-action="add-today">+ 记录今天</button>
    </div>

    ${sortedMonths.length === 0 ? `
      <div class="card p-8 text-center text-slate-400">
        <div class="text-4xl mb-3">📋</div>
        <div class="text-sm">还没有任何记录。点击右上方"记录今天"开始吧。</div>
      </div>
    ` : sortedMonths.map(m => `
      <section>
        <div class="text-xs text-slate-500 font-semibold mb-2 mt-3">${m.replace('-', '年')}月</div>
        <div class="card divide-y divide-slate-100">
          ${months[m].map(d => `
            <div class="p-3 cursor-pointer hover:bg-slate-50" data-action="edit-day" data-date="${d.date}">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-sm font-semibold whitespace-nowrap">${fmtDate(d.date)}</span>
                  <span class="text-xs text-slate-400">周${['日','一','二','三','四','五','六'][new Date(d.date).getDay()]}</span>
                </div>
                <div class="flex items-center gap-1">
                  ${getAllPainParts().filter(p => d.pains?.[p.key] > 0).slice(0, 3).map(p =>
                    `<span class="${painClass(d.pains[p.key])}" title="${escapeHtml(p.label)}">${p.emoji}</span>`
                  ).join('')}
                </div>
              </div>
              ${d.summary ? `<div class="text-xs text-slate-600 mt-1.5 line-clamp-2">${escapeHtml(d.summary)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </section>
    `).join('')}
  `;

  container.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    if (t.dataset.action === 'add-today') navigate('dailyEdit', { date: todayStr() });
    if (t.dataset.action === 'edit-day') navigate('dailyEdit', { date: t.dataset.date });
  });
}

/* ---------- 8. PAGE: DAILY EDIT ---------- */

function renderDailyEdit(container, ctx) {
  const date = ctx.date || todayStr();
  const existing = getDailyByDate(date);
  const log = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: uid(),
    date,
    pains: {},
    meds: {},
    customMeds: [],
    bowel: '',
    summary: '',
    tags: [],
  };

  function paintPainRow(p) {
    const cur = log.pains?.[p.key] || 0;
    return `
      <div class="py-2" data-pain-row="${escapeHtml(p.key)}">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm">${p.emoji} ${escapeHtml(p.label)}</span>
          <span class="text-xs text-slate-500" data-display="${escapeHtml(p.key)}">${cur > 0 ? cur + ' 度' : '无'}</span>
        </div>
        <input type="range" min="0" max="10" step="1" value="${cur}" data-pain="${escapeHtml(p.key)}"
               class="w-full accent-brand-500" />
      </div>
    `;
  }

  function paintMedChip(m) {
    return `<button type="button" class="chip ${log.meds?.[m.key] ? 'is-on' : ''}" data-med="${escapeHtml(m.key)}">
        💊 ${escapeHtml(m.label)}
      </button>`;
  }

  container.innerHTML = `
    <button class="btn-ghost" data-action="back">← 返回</button>

    <section class="card p-4 space-y-3">
      <div>
        <label class="label">日期</label>
        <input type="text" class="input" id="logDate" value="${escapeHtml(date)}" inputmode="numeric" autocomplete="off" placeholder="YYYY-MM-DD" />
      </div>
    </section>

    <section class="card p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="font-semibold text-sm">身体状况 · 痛苦程度（0–10）</div>
        <button type="button" class="text-brand-600 text-xs font-medium" id="addPainBtn">+ 新增身体问题</button>
      </div>
      <div id="painRows">${getAllPainParts().map(paintPainRow).join('')}</div>
    </section>

    <section class="card p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="font-semibold text-sm">用药</div>
        <button type="button" class="text-brand-600 text-xs font-medium" id="addMedBtn">+ 新增药物</button>
      </div>
      <div class="flex flex-wrap gap-1.5" id="medsRow">
        ${getAllMedItems().map(paintMedChip).join('')}
      </div>
      <div class="mt-3">
        <label class="label">其他一次性药物（逗号或换行分隔）</label>
        <textarea class="textarea" id="customMeds" placeholder="今天临时吃的，不需要常用的药">${(log.customMeds || []).join('，')}</textarea>
      </div>
    </section>

    <section class="card p-4 space-y-3">
      <div>
        <label class="label">大便情况</label>
        <input class="input" id="bowel" placeholder="例如：正常 / 便秘 / 腹泻3次" value="${escapeHtml(log.bowel || '')}" />
      </div>
      <div>
        <label class="label">摘要 · 当日笔记</label>
        <textarea class="textarea" id="summary" rows="4" placeholder="今天身体感觉如何？吃了什么药？有看诊吗？">${escapeHtml(log.summary || '')}</textarea>
      </div>
    </section>

    <div class="flex items-center justify-between gap-2">
      ${existing ? `<button class="btn-danger" data-action="delete">删除该日记录</button>` : '<div></div>'}
      <div class="flex gap-2">
        <button class="btn-ghost" data-action="back">取消</button>
        <button class="btn-primary" data-action="save">保存</button>
      </div>
    </div>
  `;

  attachChineseDatePicker($('#logDate', container), date);

  // Pain sliders
  container.addEventListener('input', e => {
    const slider = e.target.closest('[data-pain]');
    if (slider) {
      const k = slider.dataset.pain;
      const v = parseInt(slider.value, 10);
      log.pains[k] = v;
      const disp = container.querySelector(`[data-display="${k}"]`);
      if (disp) disp.textContent = v > 0 ? v + ' 度' : '无';
    }
  });

  // Med chips
  container.addEventListener('click', e => {
    const chip = e.target.closest('[data-med]');
    if (chip) {
      const k = chip.dataset.med;
      log.meds[k] = !log.meds[k];
      chip.classList.toggle('is-on', log.meds[k]);
    }
    const action = e.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'back')   navigate('dashboard');
    if (action.dataset.action === 'delete') {
      const inp = $('#logDate', container);
      if (inp && inp._fp) {
        try { inp._fp.close(); } catch (_) { /* ok */ }
      }
      openDeleteConfirmModal({
        title: '删除当日记录',
        bodyHtml:
          '<p class="text-sm text-slate-600">确定删除当日记录？此操作<strong>不可撤销</strong>。</p>',
        onConfirmed: () => {
          removeById('daily', log.id);
          toast('已删除', 'success');
          navigate('daily');
        },
      });
      return;
    }
    if (action.dataset.action === 'save') {
      log.date    = $('#logDate', container).value;
      log.summary = $('#summary', container).value.trim();
      log.bowel   = $('#bowel',   container).value.trim();
      log.customMeds = $('#customMeds', container).value
        .split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
      // Clean zero-pains
      Object.keys(log.pains).forEach(k => { if (!log.pains[k]) delete log.pains[k]; });
      upsert('daily', log);
      toast('已保存', 'success');
      navigate('dashboard');
    }
  });

  // "+ 新增身体问题" — inline add form below pain section
  const addPainBtn = document.getElementById('addPainBtn');
  if (addPainBtn) {
    addPainBtn.addEventListener('click', () => {
      const painRows = document.getElementById('painRows');
      if (painRows.querySelector('.inline-add-pain')) return; // already open
      const wrap = document.createElement('div');
      wrap.className = 'inline-add-pain mt-3 p-3 rounded-xl bg-brand-50 border border-brand-100 space-y-2';
      wrap.innerHTML = `
        <div class="text-xs text-brand-700 font-semibold">新增一个身体问题</div>
        <input class="input" id="newPainName" placeholder="例如：膝盖痛 / 脖子僵硬 / 失眠" />
        <div class="flex items-center gap-2">
          <input class="input flex-1" id="newPainEmoji" maxlength="4" value="🤕" />
          <button type="button" class="btn-primary" id="confirmAddPain">添加</button>
          <button type="button" class="btn-ghost" id="cancelAddPain">取消</button>
        </div>
        <div class="flex flex-wrap gap-1">
          ${['🤕','😣','🥴','🤢','😪','🥶','🥵','💢','😖','😫','😩','🧠','🫀','🫁','🦴','🦵','🦶','🦾','👂','👁️','🦷','🤧','🩸','💤']
            .map(e => `<button type="button" class="chip emoji-pick-pain" data-emoji="${e}">${e}</button>`).join('')}
        </div>
      `;
      painRows.appendChild(wrap);
      wrap.querySelector('#newPainName').focus();
      wrap.querySelectorAll('.emoji-pick-pain').forEach(b => {
        b.addEventListener('click', () => {
          wrap.querySelector('#newPainEmoji').value = b.dataset.emoji;
        });
      });
      wrap.querySelector('#cancelAddPain').addEventListener('click', () => wrap.remove());
      wrap.querySelector('#confirmAddPain').addEventListener('click', () => {
        const name = wrap.querySelector('#newPainName').value.trim();
        const emoji = (wrap.querySelector('#newPainEmoji').value || '🤕').trim() || '🤕';
        if (!name) { toast('请填写名称', 'error'); return; }
        if (getAllPainParts().some(p => p.label === name || p.key === name)) {
          toast('该身体问题已存在', 'error'); return;
        }
        state.customPainParts = state.customPainParts || [];
        state.customPainParts.push({ key: name, label: name, emoji });
        saveState();
        // Append the new pain row without re-rendering existing rows (preserves slider state)
        wrap.remove();
        const tmp = document.createElement('div');
        tmp.innerHTML = paintPainRow({ key: name, label: name, emoji });
        painRows.appendChild(tmp.firstElementChild);
        toast('已添加：' + emoji + ' ' + name, 'success');
      });
    });
  }

  // "+ 新增药物" — inline add form below med chips
  const addMedBtn = document.getElementById('addMedBtn');
  if (addMedBtn) {
    addMedBtn.addEventListener('click', () => {
      const medsRow = document.getElementById('medsRow');
      if (medsRow.parentElement.querySelector('.inline-add-med')) return;
      const wrap = document.createElement('div');
      wrap.className = 'inline-add-med mt-3 p-3 rounded-xl bg-brand-50 border border-brand-100 space-y-2';
      wrap.innerHTML = `
        <div class="text-xs text-brand-700 font-semibold">新增一种常用药物</div>
        <input class="input" id="newMedName" placeholder="例如：维生素D / 钙片 / 蒙脱石散" />
        <div class="flex items-center gap-2">
          <button type="button" class="btn-primary" id="confirmAddMed">添加</button>
          <button type="button" class="btn-ghost" id="cancelAddMed">取消</button>
        </div>
        <div class="text-[11px] text-slate-500">添加后会成为快速勾选的常用药；只吃一次的偶发药物建议填在下方"其他一次性药物"里。</div>
      `;
      medsRow.parentElement.insertBefore(wrap, medsRow.nextSibling);
      wrap.querySelector('#newMedName').focus();
      wrap.querySelector('#cancelAddMed').addEventListener('click', () => wrap.remove());
      wrap.querySelector('#confirmAddMed').addEventListener('click', () => {
        const name = wrap.querySelector('#newMedName').value.trim();
        if (!name) { toast('请填写药物名称', 'error'); return; }
        if (getAllMedItems().some(m => m.label === name || m.key === name)) {
          toast('该药物已存在', 'error'); return;
        }
        state.customMedItems = state.customMedItems || [];
        state.customMedItems.push({ key: name, label: name });
        saveState();
        // Append new chip without disturbing existing toggle states
        wrap.remove();
        const tmp = document.createElement('div');
        tmp.innerHTML = paintMedChip({ key: name, label: name });
        medsRow.appendChild(tmp.firstElementChild);
        toast('已添加：💊 ' + name, 'success');
      });
    });
  }
}

/* ---------- 9. PAGE: VACCINES ---------- */

function renderVaccines(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-500">共 ${state.vaccines.length} 条疫苗记录</div>
      <button class="btn-primary" data-action="add">+ 添加疫苗</button>
    </div>
    ${state.vaccines.length === 0 ? `
      <div class="card p-8 text-center text-slate-400">
        <div class="text-4xl mb-3">💉</div>
        <div class="text-sm">还没有疫苗记录</div>
      </div>
    ` : `
      <div class="card divide-y divide-slate-100">
        ${state.vaccines.map(v => `
          <div class="p-3 cursor-pointer hover:bg-slate-50" data-action="edit" data-id="${v.id}">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xl">💉</span>
                <div>
                  <div class="font-semibold text-sm">${escapeHtml(v.name)}</div>
                  ${v.dose ? `<div class="text-xs text-slate-500">${escapeHtml(v.dose)}</div>` : ''}
                </div>
              </div>
              <div class="text-right">
                <div class="text-xs text-slate-500">${fmtDate(v.date)}</div>
                ${v.duration ? `<div class="text-xs text-slate-400">${escapeHtml(v.duration)}</div>` : ''}
              </div>
            </div>
            ${v.notes ? `<div class="text-xs text-slate-500 mt-1.5 pl-7">${escapeHtml(v.notes)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `}
  `;

  container.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    if (t.dataset.action === 'add') openVaccineEditor();
    if (t.dataset.action === 'edit') openVaccineEditor(t.dataset.id);
  });
}

function openVaccineEditor(id) {
  const existing = id ? state.vaccines.find(x => x.id === id) : null;
  const v = existing ? { ...existing } : {
    id: uid(), date: todayStr(), name: '', dose: '', duration: '', location: '', notes: ''
  };

  openModal('疫苗记录', `
    <div class="space-y-3">
      <div>
        <label class="label">日期</label>
        <input class="input" type="text" id="vacDate" value="${escapeHtml(v.date)}" inputmode="numeric" autocomplete="off" placeholder="YYYY-MM-DD" />
      </div>
      <div>
        <label class="label">疫苗名称</label>
        <input class="input" id="vacName" value="${escapeHtml(v.name)}"
          placeholder="例如：莫得纳 / 流感疫苗 / 带状疱疹" list="vacNameList" />
        <datalist id="vacNameList">
          <option value="流感疫苗"/>
          <option value="新冠疫苗 莫得纳"/>
          <option value="新冠疫苗 BNT"/>
          <option value="带状疱疹疫苗"/>
          <option value="肺炎13价"/>
          <option value="肺炎23价"/>
          <option value="破伤风"/>
          <option value="HPV"/>
          <option value="乙肝"/>
        </datalist>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">剂次</label>
          <input class="input" id="vacDose" value="${escapeHtml(v.dose)}" placeholder="例如：第1剂" />
        </div>
        <div>
          <label class="label">效期</label>
          <input class="input" id="vacDuration" value="${escapeHtml(v.duration)}" placeholder="例如：管5年 / 终身" />
        </div>
      </div>
      <div>
        <label class="label">接种地点 / 医师</label>
        <input class="input" id="vacLocation" value="${escapeHtml(v.location)}" placeholder="例如：佳佑小儿科" />
      </div>
      <div>
        <label class="label">备注</label>
        <textarea class="textarea" id="vacNotes">${escapeHtml(v.notes)}</textarea>
      </div>
    </div>
  `, [
    existing ? { label: '删除', class: 'btn-danger', onClick: () => {
      const vaccineId = v.id;
      const dEl = document.getElementById('vacDate');
      if (dEl && dEl._fp) {
        try { dEl._fp.close(); } catch (_) { /* ok */ }
      }
      closeModal();
      openDeleteConfirmModal({
        title: '删除疫苗记录',
        bodyHtml:
          '<p class="text-sm text-slate-600">确定删除这条<strong>疫苗记录</strong>？此操作<strong>不可撤销</strong>。</p>',
        onCancel: () => openVaccineEditor(vaccineId),
        onConfirmed: () => {
          removeById('vaccines', vaccineId);
          toast('已删除', 'success');
          navigate(currentPage, currentContext);
        },
      });
    }} : null,
    { label: '取消', class: 'btn-ghost', onClick: closeModal },
    { label: '保存', class: 'btn-primary', onClick: () => {
      v.date = $('#vacDate').value;
      v.name = $('#vacName').value.trim();
      if (!v.name) { toast('请填写疫苗名称', 'error'); return; }
      v.dose = $('#vacDose').value.trim();
      v.duration = $('#vacDuration').value.trim();
      v.location = $('#vacLocation').value.trim();
      v.notes = $('#vacNotes').value.trim();
      upsert('vaccines', v);
      closeModal();
      toast('已保存', 'success');
      navigate(currentPage, currentContext);
    }}
  ].filter(Boolean));
  attachChineseDatePicker(document.getElementById('vacDate'), v.date);
}

/* ---------- 10. PAGE: VISITS ---------- */

function renderVisits(container) {
  // Filter by clinic
  const filterClinic = currentContext.filterClinic || 'all';
  const filtered = filterClinic === 'all'
    ? state.visits
    : state.visits.filter(v => v.clinic === filterClinic);

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-500">共 ${filtered.length} 次看诊</div>
      <button class="btn-primary" data-action="add">+ 添加</button>
    </div>

    <!-- Clinic filter chips -->
    <div class="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
      <button class="chip ${filterClinic==='all'?'is-on':''}" data-filter="all">全部</button>
      ${getAllClinics().map(c => `
        <button class="chip ${filterClinic===c.key?'is-on':''}" data-filter="${c.key}">
          ${c.emoji} ${escapeHtml(c.label)}
          <span class="ml-1 text-slate-400">${state.visits.filter(v => v.clinic === c.key).length}</span>
        </button>
      `).join('')}
    </div>

    ${filtered.length === 0 ? `
      <div class="card p-8 text-center text-slate-400">
        <div class="text-4xl mb-3">🏥</div>
        <div class="text-sm">${filterClinic === 'all' ? '还没有看诊记录' : '该科室还没有记录'}</div>
      </div>
    ` : `
      <div class="card divide-y divide-slate-100">
        ${filtered.map(v => {
          const clinic = findClinic(v.clinic);
          return `
            <div class="p-3 cursor-pointer hover:bg-slate-50" data-action="edit" data-id="${v.id}">
              <div class="flex items-start justify-between">
                <div class="flex items-start gap-2 flex-1 min-w-0">
                  <span class="text-xl">${clinic.emoji}</span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1 flex-wrap">
                      <span class="font-semibold text-sm">${escapeHtml(clinic.label)}</span>
                      ${v.doctor ? `<span class="text-xs text-slate-500">· ${escapeHtml(v.doctor)}</span>` : ''}
                    </div>
                    ${v.summary ? `<div class="text-xs text-slate-600 mt-1 line-clamp-2">${escapeHtml(v.summary)}</div>` : ''}
                    ${v.followUp ? `<div class="text-xs text-amber-600 mt-1">⏰ 回诊：${escapeHtml(v.followUp)}</div>` : ''}
                  </div>
                </div>
                <div class="text-xs text-slate-400 whitespace-nowrap ml-2">${fmtDate(v.date)}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  container.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (t) {
      if (t.dataset.action === 'add')  openVisitEditor();
      if (t.dataset.action === 'edit') openVisitEditor(t.dataset.id);
    }
    const f = e.target.closest('[data-filter]');
    if (f) {
      navigate('visits', { filterClinic: f.dataset.filter });
    }
  });
}

function openVisitEditor(id) {
  const existing = id ? state.visits.find(x => x.id === id) : null;
  const v = existing ? { ...existing } : {
    id: uid(), date: todayStr(), clinic: '', doctor: '',
    summary: '', prescription: '', followUp: ''
  };

  openModal('看诊记录', `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">日期</label>
          <input class="input" type="text" id="visitDate" value="${escapeHtml(v.date)}" inputmode="numeric" autocomplete="off" placeholder="YYYY-MM-DD" />
        </div>
        <div>
          <label class="label">
            <span>科室</span>
            <button type="button" class="text-brand-600 text-xs ml-1 font-normal" id="addClinicBtn">+ 新增</button>
          </label>
          <select class="select" id="visitClinic">
            <option value="">请选择</option>
            ${getAllClinics().map(c =>
              `<option value="${c.key}" ${v.clinic===c.key?'selected':''}>${c.emoji} ${c.label}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="label">医师</label>
        <input class="input" id="visitDoctor" value="${escapeHtml(v.doctor)}" placeholder="可选" />
      </div>
      <div>
        <label class="label">看诊小结（检查结果、诊断）</label>
        <textarea class="textarea" id="visitSummary" rows="3" placeholder="例如：内膜0.47公分，子宫后倾轻微下垂">${escapeHtml(v.summary)}</textarea>
      </div>
      <div>
        <label class="label">用药 / 处置</label>
        <textarea class="textarea" id="visitRx" rows="2">${escapeHtml(v.prescription)}</textarea>
      </div>
      <div>
        <label class="label">回诊安排</label>
        <input class="input" id="visitFollowUp" value="${escapeHtml(v.followUp)}" placeholder="例如：半年后追踪 / 11月1日大肠镜" />
      </div>
    </div>
  `, [
    existing ? { label: '删除', class: 'btn-danger', onClick: () => {
      const visitId = v.id;
      const vdEl = document.getElementById('visitDate');
      if (vdEl && vdEl._fp) {
        try { vdEl._fp.close(); } catch (_) { /* ok */ }
      }
      closeModal();
      openDeleteConfirmModal({
        title: '删除看诊记录',
        bodyHtml:
          '<p class="text-sm text-slate-600">确定删除这条<strong>看诊记录</strong>？此操作<strong>不可撤销</strong>。</p>',
        onCancel: () => openVisitEditor(visitId),
        onConfirmed: () => {
          removeById('visits', visitId);
          toast('已删除', 'success');
          navigate(currentPage, currentContext);
        },
      });
    }} : null,
    { label: '取消', class: 'btn-ghost', onClick: closeModal },
    { label: '保存', class: 'btn-primary', onClick: () => {
      v.date    = $('#visitDate').value;
      v.clinic  = $('#visitClinic').value;
      v.doctor  = $('#visitDoctor').value.trim();
      v.summary = $('#visitSummary').value.trim();
      v.prescription = $('#visitRx').value.trim();
      v.followUp = $('#visitFollowUp').value.trim();
      if (!v.clinic) { toast('请选择科室', 'error'); return; }
      upsert('visits', v);
      closeModal();
      toast('已保存', 'success');
      navigate(currentPage, currentContext);
    }}
  ].filter(Boolean));

  attachChineseDatePicker(document.getElementById('visitDate'), v.date);

  // Wire the "+ 新增" button on the clinic field.
  // Opens a small inline form INSIDE the same modal so the rest of the
  // visit form's state (date, doctor, summary...) is preserved.
  const addBtn = document.getElementById('addClinicBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const wrapId = 'addClinicInline';
      let wrap = document.getElementById(wrapId);
      if (wrap) { wrap.remove(); return; }
      wrap = document.createElement('div');
      wrap.id = wrapId;
      wrap.className = 'mt-2 p-3 rounded-xl bg-brand-50 border border-brand-100 space-y-2';
      wrap.innerHTML = `
        <div class="text-xs text-brand-700 font-semibold">新增一个科室</div>
        <input class="input" id="newClinicName" placeholder="科室名称，例如：肾内科 / 内分泌科 / 麻醉科" />
        <div class="flex items-center gap-2">
          <input class="input flex-1" id="newClinicEmoji" maxlength="4" value="🏥" />
          <button type="button" class="btn-primary" id="confirmAddClinic">添加</button>
          <button type="button" class="btn-ghost" id="cancelAddClinic">取消</button>
        </div>
        <div class="flex flex-wrap gap-1">
          ${['🏥','🩺','💊','🧪','🦷','👁️','👂','🫀','🫁','🦴','🧠','🌿','🌸','🦋','🍽️','🔪','🤲','🧘','🦠','💉']
            .map(e => `<button type="button" class="chip emoji-pick" data-emoji="${e}">${e}</button>`).join('')}
        </div>
      `;
      // Insert after the clinic <select>
      const sel = document.getElementById('visitClinic');
      sel.parentElement.appendChild(wrap);
      document.getElementById('newClinicName').focus();

      wrap.querySelectorAll('.emoji-pick').forEach(b => {
        b.addEventListener('click', () => {
          document.getElementById('newClinicEmoji').value = b.dataset.emoji;
        });
      });
      document.getElementById('cancelAddClinic').addEventListener('click', () => wrap.remove());
      document.getElementById('confirmAddClinic').addEventListener('click', () => {
        const name = document.getElementById('newClinicName').value.trim();
        const emoji = (document.getElementById('newClinicEmoji').value || '🏥').trim() || '🏥';
        if (!name) { toast('请填写科室名称', 'error'); return; }
        if (getAllClinics().some(c => c.label === name || c.key === name)) {
          toast('该科室已存在', 'error'); return;
        }
        state.customClinics = state.customClinics || [];
        state.customClinics.push({ key: name, label: name, emoji });
        saveState();
        // Rebuild the select options and select the newly added clinic
        sel.innerHTML = '<option value="">请选择</option>' +
          getAllClinics().map(c =>
            `<option value="${c.key}" ${name===c.key?'selected':''}>${c.emoji} ${c.label}</option>`
          ).join('');
        sel.value = name;
        wrap.remove();
        toast('已添加：' + emoji + ' ' + name, 'success');
      });
    });
  }
}

/**
 * Generic custom-item manager modal.
 * @param {object} opts
 *   title       - modal title
 *   builtinNum  - number of built-in items (for the "已内置 N 个" line)
 *   collection  - state key, e.g. 'customClinics' / 'customPainParts' / 'customMedItems'
 *   emptyHint   - hint shown when no custom items exist
 *   countUsage  - (key) => number, used to warn before deletion
 *   usageLabel  - e.g. '次看诊' / '天有该不适' / '天有该用药'
 *   itemKind    - '科室' / '身体问题' / '药物'
 */
function openCustomItemManager(opts) {
  const {
    title, builtinNum, collection, emptyHint,
    countUsage, usageLabel, itemKind
  } = opts;

  const buildBody = () => {
    const custom = state[collection] || [];
    return `
      <div class="space-y-3">
        <div class="text-xs text-slate-500">系统已内置 ${builtinNum} 个${itemKind}。你可以在这里管理自己新增的项目。</div>
        ${custom.length === 0 ? `
          <div class="text-sm text-slate-400 text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
            还没有自定义${itemKind}<br/>
            <span class="text-xs">${emptyHint}</span>
          </div>
        ` : `
          <div class="card divide-y divide-slate-100">
            ${custom.map(c => `
              <div class="p-3 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  ${c.emoji ? `<span class="text-xl">${c.emoji}</span>` : '<span class="text-xl">💊</span>'}
                  <span class="font-medium text-sm">${escapeHtml(c.label)}</span>
                  <span class="text-xs text-slate-400">${countUsage(c.key)} ${usageLabel}</span>
                </div>
                <button class="btn-danger" data-del="${escapeHtml(c.key)}">删除</button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  };

  const attachDeleteHandlers = (panel) => {
    panel.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.del;
        const item = (state[collection] || []).find((it) => it.key === key);
        const nameEscaped = escapeHtml(item?.label || key);
        const used = countUsage(key);
        const bodyHtml =
          used > 0
            ? `<p class="text-sm text-slate-600">「${nameEscaped}」已有 <strong>${used}</strong> ${usageLabel}。删除后历史数据保留但不再出现在选项中。此操作<strong>不可撤销</strong>。</p>`
            : `<p class="text-sm text-slate-600">确定删除「${nameEscaped}」这项自定义<strong>${escapeHtml(itemKind)}</strong>？此操作<strong>不可撤销</strong>。</p>`;
        closeModal();
        openDeleteConfirmModal({
          title: `删除自定义${itemKind}`,
          bodyHtml,
          onCancel: () => openCustomItemManager(opts),
          onConfirmed: () => {
            state[collection] = (state[collection] || []).filter((it) => it.key !== key);
            saveState();
            toast('已删除', 'success');
            openCustomItemManager(opts);
          },
        });
      });
    });
  };

  openModal(title, buildBody(), [
    { label: '完成', class: 'btn-primary', onClick: closeModal }
  ]);
  const body = document.querySelector('.modal-panel > div.overflow-y-auto');
  if (body) attachDeleteHandlers(body);
}

function openClinicManager() {
  openCustomItemManager({
    title:      '管理科室',
    builtinNum: CLINICS.length,
    collection: 'customClinics',
    emptyHint:  '在"看诊"页面新增看诊记录时，点击科室旁的"+ 新增"按钮即可添加',
    countUsage: (key) => state.visits.filter(v => v.clinic === key).length,
    usageLabel: '次看诊',
    itemKind:   '科室',
  });
}

function openPainPartManager() {
  openCustomItemManager({
    title:      '管理身体问题',
    builtinNum: PAIN_PARTS.length,
    collection: 'customPainParts',
    emptyHint:  '在"每日记录"里点击身体状况旁的"+ 新增身体问题"即可添加',
    countUsage: (key) => state.daily.filter(d => (d.pains || {})[key] > 0).length,
    usageLabel: '天有该不适',
    itemKind:   '身体问题',
  });
}

function openMedItemManager() {
  openCustomItemManager({
    title:      '管理药物',
    builtinNum: MEDICATIONS.length,
    collection: 'customMedItems',
    emptyHint:  '在"每日记录"里点击用药旁的"+ 新增药物"即可添加',
    countUsage: (key) => state.daily.filter(d => (d.meds || {})[key]).length,
    usageLabel: '天有用药',
    itemKind:   '药物',
  });
}

function openInsurerManager() {
  openCustomItemManager({
    title:      '管理保险公司',
    builtinNum: INSURERS.length,
    collection: 'customInsurers',
    emptyHint:  '在"理赔"页面新增理赔时，点击保险旁的"+ 新增"按钮即可添加',
    countUsage: (key) => state.claims.filter(c => c.insurer === key).length,
    usageLabel: '单理赔',
    itemKind:   '保险公司',
  });
}

function openEncourageManager() {
  const rebuildBody = () => {
    const list = state.customEncouragements || [];
    return `
      <div class="space-y-3 text-sm">
        ${list.length === 0 ? '' : `
          <div class="max-h-52 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
            ${list.map((ln, i) => `
              <div class="flex items-start gap-2 p-2.5">
                <p class="flex-1 text-slate-700 leading-snug">${escapeHtml(ln)}</p>
                <button type="button" class="text-red-600 text-xs whitespace-nowrap shrink-0 enc-del" data-enc-i="${i}">删除</button>
              </div>
            `).join('')}
          </div>`}
        <div>
          <label class="label">添加寄语（可多行，每行一条）</label>
          <textarea class="textarea" id="newEncLines" rows="4" placeholder="例如：晚饭后散步五分钟就好。\n爱你的人：___"></textarea>
          <button type="button" class="btn-primary w-full mt-2" id="encAddSubmit">加入寄语库</button>
        </div>
      </div>
    `;
  };

  openModal('扩充今日寄语', rebuildBody(), [
    { label: '完成', class: 'btn-ghost', onClick: closeModal }
  ]);

  const bind = () => {
    const bodyEl = document.querySelector('.modal-panel > div.overflow-y-auto');
    if (!bodyEl) return;

    bodyEl.querySelectorAll('.enc-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.encI, 10);
        const line = (state.customEncouragements || [])[i];
        const raw = String(line ?? '');
        const snippet = escapeHtml(raw.length > 120 ? `${raw.slice(0, 120)}…` : raw);
        closeModal();
        openDeleteConfirmModal({
          title: '删除寄语',
          bodyHtml: `
            <p class="text-sm text-slate-600">确定删除这条<strong>寄语</strong>？此操作<strong>不可撤销</strong>。</p>
            <p class="text-xs text-slate-500 mt-2 leading-snug">「${snippet}」</p>
          `,
          onCancel: () => openEncourageManager(),
          onConfirmed: () => {
            state.customEncouragements = (state.customEncouragements || []).filter((_, j) => j !== i);
            saveState();
            toast('已删除', 'success');
            openEncourageManager();
          },
        });
      });
    });

    const addBtn = bodyEl.querySelector('#encAddSubmit');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const ta = bodyEl.querySelector('#newEncLines');
        const lines = (ta?.value || '')
          .split(/\n+/)
          .map(s => s.trim())
          .filter(Boolean);
        if (!lines.length) { toast('请先写一句', 'error'); return; }
        state.customEncouragements = [...(state.customEncouragements || []), ...lines];
        saveState();
        if (ta) ta.value = '';
        bodyEl.innerHTML = rebuildBody();
        toast(`已添加 ${lines.length} 条`, 'success');
        bind();
      });
    }
  };
  bind();
}

/* ---------- 11. PAGE: CLAIMS (Insurance) ---------- */

function renderClaims(container) {
  const filterInsurer = currentContext.filterInsurer || 'all';
  const filtered = filterInsurer === 'all'
    ? state.claims
    : state.claims.filter(c => c.insurer === filterInsurer);

  // Stats per insurer (built-in + custom)
  const allInsurers = getAllInsurers();
  const statsPerInsurer = {};
  allInsurers.forEach(ins => {
    const list = state.claims.filter(c => c.insurer === ins.key);
    statsPerInsurer[ins.key] = {
      count: list.length,
      paid:  list.filter(c => c.status === 'paid').reduce((s, c) => s + (Number(c.amount) || 0), 0),
      pending: list.filter(c => !['paid','denied'].includes(c.status)).reduce((s, c) => s + (Number(c.amount) || 0), 0),
    };
  });

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-500">共 ${filtered.length} 单理赔</div>
      <button class="btn-primary" data-action="add">+ 添加</button>
    </div>

    <!-- Per-insurer stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      ${allInsurers.map(ins => `
        <div class="card p-3">
          <div class="text-xs text-slate-500">${escapeHtml(ins.label)}</div>
          <div class="flex items-baseline justify-between mt-1">
            <div>
              <div class="text-lg font-bold text-green-600">${statsPerInsurer[ins.key].paid.toLocaleString('zh-CN')}<span class="text-xs text-slate-400 ml-1">元</span></div>
              <div class="text-[11px] text-slate-400">累计到账</div>
            </div>
            ${statsPerInsurer[ins.key].pending > 0 ? `
              <div class="text-right">
                <div class="text-sm font-semibold text-amber-600">${statsPerInsurer[ins.key].pending.toLocaleString('zh-CN')}</div>
                <div class="text-[11px] text-slate-400">待跟进</div>
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Insurer filter -->
    <div class="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
      <button class="chip ${filterInsurer==='all'?'is-on':''}" data-filter="all">全部</button>
      ${allInsurers.map(i => `
        <button class="chip ${filterInsurer===i.key?'is-on':''}" data-filter="${i.key}">${escapeHtml(i.label)}</button>
      `).join('')}
    </div>

    ${filtered.length === 0 ? `
      <div class="card p-8 text-center text-slate-400">
        <div class="text-4xl mb-3">📑</div>
        <div class="text-sm">还没有理赔记录</div>
      </div>
    ` : `
      <div class="card divide-y divide-slate-100">
        ${filtered.map(c => {
          const status = CLAIM_STATUS.find(s => s.key === c.status) || CLAIM_STATUS[0];
          return `
            <div class="p-3 cursor-pointer hover:bg-slate-50" data-action="edit" data-id="${c.id}">
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-sm">${escapeHtml(findInsurer(c.insurer).label || c.insurer || '保险')}</span>
                    <span class="chip ${status.color}">${status.label}</span>
                    ${c.type ? `<span class="text-xs text-slate-500">${escapeHtml(c.type)}</span>` : ''}
                  </div>
                  ${c.description ? `<div class="text-xs text-slate-600 mt-1 line-clamp-2">${escapeHtml(c.description)}</div>` : ''}
                </div>
                <div class="text-right ml-2">
                  <div class="text-base font-bold text-${c.status==='paid'?'green':'slate'}-600">${Number(c.amount||0).toLocaleString('zh-CN')}</div>
                  <div class="text-xs text-slate-400">${fmtDate(c.date)}</div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  container.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (t) {
      if (t.dataset.action === 'add')  openClaimEditor();
      if (t.dataset.action === 'edit') openClaimEditor(t.dataset.id);
    }
    const f = e.target.closest('[data-filter]');
    if (f) {
      navigate('claims', { filterInsurer: f.dataset.filter });
    }
  });
}

function openClaimEditor(id) {
  const existing = id ? state.claims.find(x => x.id === id) : null;
  const c = existing ? { ...existing } : {
    id: uid(), date: todayStr(), insurer: '', type: '',
    amount: '', description: '', status: 'pending'
  };

  openModal('保险理赔', `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">日期</label>
          <input class="input" type="text" id="claimDate" value="${escapeHtml(c.date)}" inputmode="numeric" autocomplete="off" placeholder="YYYY-MM-DD" />
        </div>
        <div>
          <label class="label">
            <span>保险</span>
            <button type="button" class="text-brand-600 text-xs ml-1 font-normal" id="addInsurerBtn">+ 新增</button>
          </label>
          <select class="select" id="claimInsurer">
            <option value="">请选择</option>
            ${getAllInsurers().map(i => `<option value="${i.key}" ${c.insurer===i.key?'selected':''}>${escapeHtml(i.label)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">金额（元）</label>
          <input class="input" type="number" inputmode="decimal" id="claimAmount" value="${escapeHtml(c.amount)}" />
        </div>
        <div>
          <label class="label">状态</label>
          <select class="select" id="claimStatus">
            ${CLAIM_STATUS.map(s => `<option value="${s.key}" ${c.status===s.key?'selected':''}>${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="label">类型 / 项目</label>
        <input class="input" id="claimType" value="${escapeHtml(c.type)}" placeholder="例如：胆囊切除手术 / 眼睛栓塞术" />
      </div>
      <div>
        <label class="label">说明（医院、单据号等）</label>
        <textarea class="textarea" id="claimDesc">${escapeHtml(c.description)}</textarea>
      </div>
    </div>
  `, [
    existing ? { label: '删除', class: 'btn-danger', onClick: () => {
      const claimId = c.id;
      const cdEl = document.getElementById('claimDate');
      if (cdEl && cdEl._fp) {
        try { cdEl._fp.close(); } catch (_) { /* ok */ }
      }
      closeModal();
      openDeleteConfirmModal({
        title: '删除理赔记录',
        bodyHtml:
          '<p class="text-sm text-slate-600">确定删除这条<strong>理赔记录</strong>？此操作<strong>不可撤销</strong>。</p>',
        onCancel: () => openClaimEditor(claimId),
        onConfirmed: () => {
          removeById('claims', claimId);
          toast('已删除', 'success');
          navigate(currentPage, currentContext);
        },
      });
    }} : null,
    { label: '取消', class: 'btn-ghost', onClick: closeModal },
    { label: '保存', class: 'btn-primary', onClick: () => {
      c.date    = $('#claimDate').value;
      c.insurer = $('#claimInsurer').value;
      c.amount  = parseFloat($('#claimAmount').value) || 0;
      c.status  = $('#claimStatus').value;
      c.type    = $('#claimType').value.trim();
      c.description = $('#claimDesc').value.trim();
      if (!c.insurer) { toast('请选择保险', 'error'); return; }
      upsert('claims', c);
      closeModal();
      toast('已保存', 'success');
      navigate(currentPage, currentContext);
    }}
  ].filter(Boolean));

  attachChineseDatePicker(document.getElementById('claimDate'), c.date);

  // Wire the "+ 新增" button on the insurer field
  const addInsBtn = document.getElementById('addInsurerBtn');
  if (addInsBtn) {
    addInsBtn.addEventListener('click', () => {
      const wrapId = 'addInsurerInline';
      let wrap = document.getElementById(wrapId);
      if (wrap) { wrap.remove(); return; }
      wrap = document.createElement('div');
      wrap.id = wrapId;
      wrap.className = 'mt-2 p-3 rounded-xl bg-brand-50 border border-brand-100 space-y-2';
      wrap.innerHTML = `
        <div class="text-xs text-brand-700 font-semibold">新增一家保险公司</div>
        <input class="input" id="newInsurerName" placeholder="例如：国泰人寿 / 富邦产险 / 安联" />
        <div class="flex items-center gap-2">
          <button type="button" class="btn-primary" id="confirmAddInsurer">添加</button>
          <button type="button" class="btn-ghost"   id="cancelAddInsurer">取消</button>
        </div>
      `;
      const sel = document.getElementById('claimInsurer');
      sel.parentElement.appendChild(wrap);
      document.getElementById('newInsurerName').focus();
      document.getElementById('cancelAddInsurer').addEventListener('click', () => wrap.remove());
      document.getElementById('confirmAddInsurer').addEventListener('click', () => {
        const name = document.getElementById('newInsurerName').value.trim();
        if (!name) { toast('请填写保险公司名称', 'error'); return; }
        if (getAllInsurers().some(i => i.label === name || i.key === name)) {
          toast('该保险公司已存在', 'error'); return;
        }
        state.customInsurers = state.customInsurers || [];
        state.customInsurers.push({ key: name, label: name });
        saveState();
        sel.innerHTML = '<option value="">请选择</option>' +
          getAllInsurers().map(i =>
            `<option value="${i.key}" ${name===i.key?'selected':''}>${escapeHtml(i.label)}</option>`
          ).join('');
        sel.value = name;
        wrap.remove();
        toast('已添加：' + name, 'success');
      });
    });
  }
}

/* ---------- 12. PAGE: ANALYTICS ---------- */

function renderAnalytics(container) {
  const today = todayStr();
  const range = currentContext.range || 90;
  const cutoff = new Date(Date.now() - range * 86400000).toISOString().slice(0, 10);
  const inRange = state.daily.filter(d => d.date >= cutoff).sort((a,b) => a.date.localeCompare(b.date));

  // Average pain per part (covers built-in + custom + any historical key in logs)
  const allPainParts = getAllPainParts();
  const sums = {}, counts = {};
  inRange.forEach(d => {
    Object.entries(d.pains || {}).forEach(([k, v]) => {
      if (v > 0) {
        sums[k]   = (sums[k]   || 0) + v;
        counts[k] = (counts[k] || 0) + 1;
      }
    });
  });

  // Med frequency
  const medFreq = {};
  inRange.forEach(d => {
    Object.entries(d.meds || {}).forEach(([k, on]) => {
      if (on) medFreq[k] = (medFreq[k] || 0) + 1;
    });
  });

  // Clinic frequency in range
  const visitFreq = {};
  state.visits.filter(v => v.date >= cutoff).forEach(v => {
    visitFreq[v.clinic] = (visitFreq[v.clinic] || 0) + 1;
  });

  container.innerHTML = `
    <!-- Range selector -->
    <div class="flex gap-1.5 -mx-4 px-4">
      ${[30, 90, 180, 365].map(r => `
        <button class="chip ${range===r?'is-on':''}" data-range="${r}">${r}天</button>
      `).join('')}
    </div>

    <section class="card p-4">
      <div class="font-semibold text-sm mb-2">痛苦程度 · 趋势</div>
      <div class="text-xs text-slate-500 mb-2">${cutoff} 至 ${today}</div>
      <div class="analytics-chart-shell">
        <canvas id="painTrendChart"></canvas>
      </div>
    </section>

    <section class="card p-4">
      <div class="font-semibold text-sm mb-2">各部位 · 平均痛苦程度（仅当有疼痛时）</div>
      <div class="space-y-2">
        ${Object.keys(counts).length === 0 ? `<div class="text-sm text-slate-400">期内没有疼痛记录</div>` :
          Object.keys(counts)
            .sort((a, b) => counts[b] - counts[a])
            .map(key => {
              const p = findPainPart(key);
              const c = counts[key] || 0;
              const avg = c ? (sums[key] / c).toFixed(1) : 0;
              const pct = Math.min(100, (parseFloat(avg) / 10) * 100);
              return `
                <div>
                  <div class="flex items-center justify-between text-xs mb-1">
                    <span>${p.emoji} ${escapeHtml(p.label)} · <span class="text-slate-400">${c}天</span></span>
                    <span class="font-semibold">${avg} / 10</span>
                  </div>
                  <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 rounded-full" style="width:${pct}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
      </div>
    </section>

    <section class="card p-4">
      <div class="font-semibold text-sm mb-2">用药频率（近${range}天）</div>
      ${Object.keys(medFreq).length === 0 ? `<div class="text-sm text-slate-400">期内没有用药记录</div>` : `
        <div class="space-y-1.5">
          ${Object.entries(medFreq).sort((a,b)=>b[1]-a[1]).map(([k,n]) => {
            const m = findMedItem(k);
            return `
              <div class="flex items-center justify-between text-xs">
                <span>💊 ${escapeHtml(m.label)}</span>
                <span class="font-semibold">${n} 天</span>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </section>

    <section class="card p-4">
      <div class="font-semibold text-sm mb-2">看诊分布（近${range}天）</div>
      ${Object.keys(visitFreq).length === 0 ? `<div class="text-sm text-slate-400">期内没有看诊记录</div>` : `
        <div class="analytics-chart-shell analytics-chart-shell-pie">
          <canvas id="visitsPieChart"></canvas>
        </div>
      `}
    </section>
  `;

  container.addEventListener('click', e => {
    const r = e.target.closest('[data-range]');
    if (r) navigate('analytics', { range: parseInt(r.dataset.range, 10) });
  });

  // Charts
  drawPainTrendChart(inRange);
  if (Object.keys(visitFreq).length) drawVisitsPieChart(visitFreq);
}

let _painChart = null;
let _visitsChart = null;
function drawPainTrendChart(logs) {
  const canvas = document.getElementById('painTrendChart');
  if (!canvas) return;
  if (_painChart) _painChart.destroy();
  const labels = logs.map(l => l.date.slice(5));
  // Pick the 6 most-recorded pain types in this range so custom additions appear too
  const usageCount = {};
  logs.forEach(l => Object.entries(l.pains || {}).forEach(([k, v]) => {
    if (v > 0) usageCount[k] = (usageCount[k] || 0) + 1;
  }));
  const topKeys = Object.keys(usageCount).sort((a,b) => usageCount[b] - usageCount[a]).slice(0, 6);
  const datasets = topKeys.map((key, i) => {
    const p = findPainPart(key);
    return {
      label: p.label,
      data: logs.map(l => l.pains?.[key] || 0),
      borderColor: ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7'][i],
      backgroundColor: 'transparent',
      tension: 0.3,
      pointRadius: 2,
      spanGaps: true,
    };
  });
  _painChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 10, ticks: { stepSize: 2 } },
        x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } }
      }
    }
  });
}

function drawVisitsPieChart(freqMap) {
  const canvas = document.getElementById('visitsPieChart');
  if (!canvas) return;
  if (_visitsChart) _visitsChart.destroy();
  const entries = Object.entries(freqMap);
  _visitsChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: entries.map(([k]) => findClinic(k).label),
      datasets: [{
        data: entries.map(([,v]) => v),
        backgroundColor: ['#0ea5e9','#f97316','#a855f7','#22c55e','#eab308','#ef4444','#06b6d4','#8b5cf6','#ec4899','#10b981','#f59e0b','#3b82f6','#14b8a6','#f43f5e','#84cc16']
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } } }
    }
  });
}

/* ---------- 13. PAGE: MORE / SETTINGS ---------- */

function openFontScaleSettings() {
  const current = FONT_SCALE_IDS.includes(state.uiFontScale) ? state.uiFontScale : 'standard';
  const chips = FONT_SCALE_IDS.map(id => `
    <button type="button" class="chip ${current === id ? 'is-on' : ''} js-font-pick px-4 py-2" data-pick-fs="${id}">${fontScaleShortLabel(id)}</button>
  `).join(' ');
  openModal('字号', `
    <div class="flex flex-wrap gap-2 justify-center py-1">${chips}</div>
  `, [{ label: '完成', class: 'btn-primary', onClick: closeModal }]);
  $('#modalRoot').querySelectorAll('.js-font-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.pickFs;
      if (!FONT_SCALE_IDS.includes(id)) return;
      if (state.uiFontScale === id) {
        closeModal();
        navigate('more');
        return;
      }
      state.uiFontScale = id;
      saveState();
      applyUiFontScaleFromState();
      closeModal();
      toast(`已设为「${fontScaleShortLabel(id)}」`, 'success');
      navigate('more');
    });
  });
}

function openMultiDeviceSync() {
  const c = getSyncConfig();
  openModal(
    '多设备云端同步',
    `
    <div class="space-y-3 text-sm text-slate-600">
      <p>在每台设备上用<strong>相同的云端地址</strong>和<strong>相同的同步码</strong>即可共享一份档案（无需用户名密码）。</p>
      <p class="text-xs text-slate-600">保存成功后，本机会<strong>自动</strong>在打开应用、切回前台时以及约每 2 分钟检查云端；若云端存档<strong>更新</strong>（时间戳更晚），会<strong>无声合并到本机</strong>。你在「编辑当日」未保存时不会覆盖，以免丢掉正在改的内容。</p>
      <p class="text-xs text-slate-500">同步码必须与服务器环境变量 <code class="bg-slate-100 px-1 rounded text-slate-700">HEALTH_SYNC_TOKEN</code> 完全一致。详见仓库里的 flask_app.py 顶部说明。</p>
      <label class="block"><span class="text-xs text-slate-500">云端地址（不要末尾斜杠）</span>
        <input class="input mt-1 w-full" id="syncUrlField" autocomplete="off" autocapitalize="off"
          placeholder="https://你的用户名.pythonanywhere.com" value="${escapeHtml(c.baseUrl)}" />
      </label>
      <label class="block"><span class="text-xs text-slate-500">同步码</span>
        <input class="input mt-1 w-full" id="syncTokenField" type="password" autocomplete="off"
          placeholder="一串长随机口令" value="${escapeHtml(c.token)}" />
      </label>
      <div class="flex flex-col gap-2 pt-1">
        <button type="button" class="btn-primary w-full" id="syncBtnSaveTest">保存并测试连接</button>
        <button type="button" class="btn-ghost w-full" id="syncBtnPull">从云端下载（覆盖本机）</button>
        <button type="button" class="btn-ghost w-full" id="syncBtnPush">上传到云端（覆盖云端）</button>
        <button type="button" class="btn-ghost w-full text-red-600" id="syncBtnClear">停用同步（仅删掉本机的地址与同步码）</button>
      </div>
    </div>
    `,
    [{ label: '关闭', class: 'btn-ghost', onClick: closeModal }]
  );

  $('#syncBtnSaveTest').addEventListener('click', async () => {
    const urlEl = $('#syncUrlField');
    const tokEl = $('#syncTokenField');
    try {
      await testSyncConnection(urlEl.value, tokEl.value);
      setSyncConfig(urlEl.value, tokEl.value);
      startCloudAutoPull();
      toast('同步设置已保存，连接正常', 'success');
    } catch (e) {
      toast(e.message || String(e), 'error');
    }
  });

  $('#syncBtnPull').addEventListener('click', async () => {
    const urlEl = $('#syncUrlField');
    const tokEl = $('#syncTokenField');
    try {
      setSyncConfig(urlEl.value, tokEl.value);
      const env = await syncPullFromRemote();
      if (!env) {
        toast('云端还没有存档，可先在常用设备上点「上传到云端」', 'info');
        return;
      }
      closeModal();
      openDeleteConfirmModal({
        title: '从云端下载',
        confirmLabel: '覆盖本机',
        bodyHtml:
          '<p class="text-sm text-slate-600">用<strong>云端档案</strong>覆盖本机<strong>全部</strong>数据？未导出备份可能造成差异<strong>丢失</strong>。</p>',
        onCancel: () => openMultiDeviceSync(),
        onConfirmed: () => applyRemoteEnvelope(env, {}),
      });
    } catch (e) {
      toast(e.message || String(e), 'error');
    }
  });

  $('#syncBtnPush').addEventListener('click', () => {
    const urlEl = $('#syncUrlField');
    const tokEl = $('#syncTokenField');
    try {
      setSyncConfig(urlEl.value, tokEl.value);
      closeModal();
      openDeleteConfirmModal({
        title: '上传到云端',
        confirmLabel: '覆盖云端',
        bodyHtml:
          '<p class="text-sm text-slate-600">用<strong>本机数据</strong>覆盖云端？其它设备下次拉取会<strong>以此为最新</strong>。</p>',
        onCancel: () => openMultiDeviceSync(),
        onConfirmed: () => {
          void (async () => {
            try {
              saveState();
              await flushRemotePushNow();
              toast('已上传到云端', 'success');
            } catch (e) {
              toast(e.message || String(e), 'error');
            }
          })();
        },
      });
    } catch (e) {
      toast(e.message || String(e), 'error');
    }
  });

  $('#syncBtnClear').addEventListener('click', () => {
    closeModal();
    openDeleteConfirmModal({
      title: '停用同步',
      confirmLabel: '清除',
      bodyHtml:
        '<p class="text-sm text-slate-600">清除本机保存的<strong>云端地址与同步码</strong>？健康档案仍保留在本机浏览器中。</p>',
      onCancel: () => openMultiDeviceSync(),
      onConfirmed: () => {
        setSyncConfig('', '');
        stopCloudAutoPull();
        toast('已停用同步');
        navigate('more');
      },
    });
  });
}

function renderMore(container) {
  const fs = FONT_SCALE_IDS.includes(state.uiFontScale) ? state.uiFontScale : 'standard';
  const sc = getSyncConfig();
  container.innerHTML = `
    <section class="card divide-y divide-slate-100">
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="goto-vaccines">
        <div class="flex items-center gap-3"><span class="text-2xl">💉</span><span class="font-medium">疫苗记录</span></div>
        <span class="text-slate-400">›</span>
      </button>
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="goto-claims">
        <div class="flex items-center gap-3"><span class="text-2xl">📑</span><span class="font-medium">保险理赔</span></div>
        <span class="text-slate-400">›</span>
      </button>
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="goto-analytics">
        <div class="flex items-center gap-3"><span class="text-2xl">📊</span><span class="font-medium">身体状况分析</span></div>
        <span class="text-slate-400">›</span>
      </button>
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="goto-search">
        <div class="flex items-center gap-3"><span class="text-2xl">🔍</span><span class="font-medium">搜索记录</span></div>
        <span class="text-slate-400">›</span>
      </button>
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="manage-clinics">
        <div class="flex items-center gap-3"><span class="text-2xl">🏥</span>
          <div>
            <div class="font-medium">管理科室</div>
            <div class="text-xs text-slate-500">自定义科室：${(state.customClinics || []).length} 个</div>
          </div>
        </div>
        <span class="text-slate-400">›</span>
      </button>
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="manage-pains">
        <div class="flex items-center gap-3"><span class="text-2xl">🤕</span>
          <div>
            <div class="font-medium">管理身体问题</div>
            <div class="text-xs text-slate-500">自定义问题：${(state.customPainParts || []).length} 个</div>
          </div>
        </div>
        <span class="text-slate-400">›</span>
      </button>
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="manage-meds">
        <div class="flex items-center gap-3"><span class="text-2xl">💊</span>
          <div>
            <div class="font-medium">管理药物</div>
            <div class="text-xs text-slate-500">自定义药物：${(state.customMedItems || []).length} 个</div>
          </div>
        </div>
        <span class="text-slate-400">›</span>
      </button>
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="manage-insurers">
        <div class="flex items-center gap-3"><span class="text-2xl">📑</span>
          <div>
            <div class="font-medium">管理保险公司</div>
            <div class="text-xs text-slate-500">自定义保险公司：${(state.customInsurers || []).length} 家</div>
          </div>
        </div>
        <span class="text-slate-400">›</span>
      </button>
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="manage-encourage">
        <div class="flex items-center gap-3"><span class="text-2xl">🌸</span>
          <div>
            <div class="font-medium">寄语 · 加自己的话</div>
            <div class="text-xs text-slate-500">你已添加 ${(state.customEncouragements || []).length} 条专属句子 · 会与内置话术一起随机出现</div>
          </div>
        </div>
        <span class="text-slate-400">›</span>
      </button>
      <button type="button" class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="font-settings">
        <div class="flex items-center gap-3"><span class="text-2xl">📖</span>
          <div>
            <div class="font-medium">字号</div>
            <div class="text-xs text-slate-500">当前：${escapeHtml(fontScaleShortLabel(fs))}</div>
          </div>
        </div>
        <span class="text-slate-400">›</span>
      </button>
      <button type="button" class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="multi-device-sync">
        <div class="flex items-center gap-3"><span class="text-2xl">📡</span>
          <div>
            <div class="font-medium">多设备云端同步</div>
            <div class="text-xs text-slate-500">${sc.baseUrl && sc.token ? '已配置 · 可多台手机共享档案' : '未开启 · PythonAnywhere 等服务器 + 同步码'}</div>
          </div>
        </div>
        <span class="text-slate-400">›</span>
      </button>
    </section>

    <section class="card divide-y divide-slate-100">
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="import-xlsx">
        <div class="flex items-center gap-3"><span class="text-2xl">📥</span>
          <div>
            <div class="font-medium">从 Excel 导入</div>
            <div class="text-xs text-slate-500">支持原"就医头痛记录表"格式</div>
          </div>
        </div>
        <span class="text-slate-400">›</span>
      </button>
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="export-xlsx">
        <div class="flex items-center gap-3"><span class="text-2xl">📤</span>
          <div>
            <div class="font-medium">导出为 Excel</div>
            <div class="text-xs text-slate-500">备份到 .xlsx 文件</div>
          </div>
        </div>
        <span class="text-slate-400">›</span>
      </button>
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="export-json">
        <div class="flex items-center gap-3"><span class="text-2xl">💾</span>
          <div>
            <div class="font-medium">导出 JSON 备份</div>
            <div class="text-xs text-slate-500">完整数据备份</div>
          </div>
        </div>
        <span class="text-slate-400">›</span>
      </button>
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="import-json">
        <div class="flex items-center gap-3"><span class="text-2xl">📂</span>
          <div>
            <div class="font-medium">从 JSON 恢复</div>
          </div>
        </div>
        <span class="text-slate-400">›</span>
      </button>
    </section>

    <section class="card divide-y divide-slate-100">
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="install">
        <div class="flex items-center gap-3"><span class="text-2xl">📱</span>
          <div>
            <div class="font-medium">安装到主屏幕</div>
            <div class="text-xs text-slate-500">将网页变成手机 App</div>
          </div>
        </div>
        <span class="text-slate-400">›</span>
      </button>
      <button class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50" data-action="clear">
        <div class="flex items-center gap-3"><span class="text-2xl">⚠️</span>
          <div>
            <div class="font-medium text-red-600">清空所有数据</div>
            <div class="text-xs text-slate-500">建议先导出备份</div>
          </div>
        </div>
      </button>
    </section>

    <section class="card p-4 text-center text-xs text-slate-400">
      <div>张婷要健康 · v1.0</div>
      <div class="mt-1">${sc.baseUrl && sc.token ? '📡 云端同步：已启用 · 较新存档会自动拉取，本机保存会防抖上传' : '默认：档案仅保存在本机浏览器 · 可自行开启云端'}</div>
      <div class="mt-2">📊 数据：${state.daily.length} 条每日记录 · ${state.vaccines.length} 条疫苗 · ${state.visits.length} 次看诊 · ${state.claims.length} 单理赔</div>
    </section>
  `;

  container.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const a = t.dataset.action;
    if (a === 'font-settings') openFontScaleSettings();
    if (a === 'multi-device-sync') openMultiDeviceSync();
    if (a === 'goto-vaccines')  navigate('vaccines');
    if (a === 'goto-claims')    navigate('claims');
    if (a === 'goto-analytics') navigate('analytics');
    if (a === 'goto-search')    navigate('search');
    if (a === 'manage-clinics')  openClinicManager();
    if (a === 'manage-pains')    openPainPartManager();
    if (a === 'manage-meds')     openMedItemManager();
    if (a === 'manage-insurers') openInsurerManager();
    if (a === 'manage-encourage') openEncourageManager();
    if (a === 'import-xlsx')    importFromXlsx();
    if (a === 'export-xlsx')    exportToXlsx();
    if (a === 'export-json')    exportToJson();
    if (a === 'import-json')    importFromJson();
    if (a === 'install')        promptInstall();
    if (a === 'clear') {
      openDeleteConfirmModal({
        title: '清空所有数据',
        bodyHtml:
          '<p class="text-sm text-slate-600">确定清空<strong>所有</strong>健康档案数据？此操作<strong>不可撤销</strong>。建议先导出 JSON 或 Excel 备份。</p>',
        confirmLabel: '清空全部',
        onConfirmed: () => {
          state = defaultState();
          saveState();
          applyUiFontScaleFromState();
          toast('已清空', 'success');
          navigate('dashboard');
        },
      });
    }
  });
}

/* ---------- 14. PAGE: SEARCH ---------- */

function renderSearch(container) {
  const q = (currentContext.q || '').trim();
  container.innerHTML = `
    <div class="card p-3">
      <input class="input" id="searchInput" placeholder="搜索摘要、症状、医师、医院..." value="${escapeHtml(q)}" />
    </div>
    <div id="searchResults"></div>
  `;
  const input = $('#searchInput', container);
  input.focus();
  input.addEventListener('input', e => {
    runSearch(e.target.value);
  });
  if (q) runSearch(q);
}

function runSearch(q) {
  const out = $('#searchResults');
  if (!q || q.length < 1) {
    out.innerHTML = '<div class="text-sm text-slate-400 text-center py-8">输入关键字开始搜索</div>';
    return;
  }
  const lower = q.toLowerCase();
  const match = (text) => text && String(text).toLowerCase().includes(lower);

  const daily = state.daily.filter(d => match(d.summary) || match(d.bowel) || (d.customMeds || []).some(match));
  const vaccines = state.vaccines.filter(v => match(v.name) || match(v.notes) || match(v.location));
  const visits = state.visits.filter(v => match(v.clinic) || match(v.doctor) || match(v.summary) || match(v.prescription) || match(v.followUp));
  const claims = state.claims.filter(c => match(c.insurer) || match(c.type) || match(c.description));

  const total = daily.length + vaccines.length + visits.length + claims.length;
  if (total === 0) {
    out.innerHTML = '<div class="text-sm text-slate-400 text-center py-8">没有找到匹配的记录</div>';
    return;
  }

  out.innerHTML = `
    <div class="text-sm text-slate-500 mt-3 mb-2">找到 ${total} 条结果</div>
    ${daily.length ? `
      <section class="card mb-3">
        <div class="px-3 py-2 text-xs font-semibold text-slate-500">每日记录 · ${daily.length}</div>
        <div class="divide-y divide-slate-100">
          ${daily.map(d => `
            <div class="p-3 cursor-pointer hover:bg-slate-50" data-go="dailyEdit:${d.date}">
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-400">${fmtDate(d.date)}</span>
              </div>
              <div class="text-sm mt-1">${escapeHtml(d.summary || '').slice(0, 200)}</div>
            </div>
          `).join('')}
        </div>
      </section>` : ''}
    ${visits.length ? `
      <section class="card mb-3">
        <div class="px-3 py-2 text-xs font-semibold text-slate-500">看诊 · ${visits.length}</div>
        <div class="divide-y divide-slate-100">
          ${visits.map(v => `
            <div class="p-3 cursor-pointer hover:bg-slate-50" data-go="visit:${v.id}">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-sm">${escapeHtml(v.clinic)} ${v.doctor ? '· ' + escapeHtml(v.doctor) : ''}</span>
                <span class="text-xs text-slate-400">${fmtDate(v.date)}</span>
              </div>
              <div class="text-xs text-slate-600 mt-1">${escapeHtml(v.summary || '').slice(0, 200)}</div>
            </div>
          `).join('')}
        </div>
      </section>` : ''}
    ${vaccines.length ? `
      <section class="card mb-3">
        <div class="px-3 py-2 text-xs font-semibold text-slate-500">疫苗 · ${vaccines.length}</div>
        <div class="divide-y divide-slate-100">
          ${vaccines.map(v => `
            <div class="p-3 cursor-pointer hover:bg-slate-50" data-go="vaccine:${v.id}">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-sm">${escapeHtml(v.name)}</span>
                <span class="text-xs text-slate-400">${fmtDate(v.date)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </section>` : ''}
    ${claims.length ? `
      <section class="card mb-3">
        <div class="px-3 py-2 text-xs font-semibold text-slate-500">理赔 · ${claims.length}</div>
        <div class="divide-y divide-slate-100">
          ${claims.map(c => `
            <div class="p-3 cursor-pointer hover:bg-slate-50" data-go="claim:${c.id}">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-sm">${escapeHtml(c.insurer)} · ${escapeHtml(c.type || '')}</span>
                <span class="text-xs text-slate-400">${fmtDate(c.date)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </section>` : ''}
  `;
  out.querySelectorAll('[data-go]').forEach(el => {
    el.addEventListener('click', () => {
      const [type, key] = el.dataset.go.split(':');
      if (type === 'dailyEdit') navigate('dailyEdit', { date: key });
      if (type === 'visit')     openVisitEditor(key);
      if (type === 'vaccine')   openVaccineEditor(key);
      if (type === 'claim')     openClaimEditor(key);
    });
  });
}

/* ---------- 15. MODAL ---------- */

function openModal(title, bodyHtml, buttons = []) {
  const root = $('#modalRoot');
  root.innerHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal-panel" role="dialog" aria-modal="true">
        <header class="p-4 border-b border-slate-100 flex items-center justify-between">
          <div class="font-semibold">${title}</div>
          <button class="text-slate-400 text-2xl leading-none" id="modalClose">×</button>
        </header>
        <div class="p-4 overflow-y-auto flex-1">${bodyHtml}</div>
        <footer class="p-3 border-t border-slate-100 flex items-center justify-end gap-2" id="modalFooter"></footer>
      </div>
    </div>
  `;
  const footer = $('#modalFooter');
  buttons.forEach((b, i) => {
    const btn = document.createElement('button');
    btn.className = b.class || 'btn-ghost';
    btn.textContent = b.label;
    btn.addEventListener('click', b.onClick);
    footer.appendChild(btn);
  });
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', e => {
    if (e.target.id === 'modalBackdrop') closeModal();
  });
}

function closeModal() {
  $('#modalRoot').innerHTML = '';
  document.querySelectorAll('.flatpickr-calendar').forEach((el) => el.remove());
}

/**
 * 统一的删除确认弹窗（对齐「删除当日记录」：标题 + slate 段落 + 取消 / Primary 危险按钮）
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.bodyHtml  整块说明 HTML（建议含 `<p class="text-sm text-slate-600">`）
 * @param {string} [opts.confirmLabel='删除']
 * @param {string} [opts.confirmClass='btn-danger']
 * @param {Function} [opts.onCancel]  点取消或关掉后的额外逻辑（先执行 closeModal）
 * @param {Function} opts.onConfirmed 确认后的逻辑（会先 closeModal）
 */
function openDeleteConfirmModal(opts) {
  const {
    title,
    bodyHtml,
    confirmLabel = '删除',
    confirmClass = 'btn-danger',
    onCancel,
    onConfirmed,
  } = opts || {};
  openModal(title || '删除确认', bodyHtml || '<p class="text-sm text-slate-600">确定删除？此操作<strong>不可撤销</strong>。</p>', [
    {
      label: '取消',
      class: 'btn-ghost',
      onClick: () => {
        closeModal();
        if (typeof onCancel === 'function') onCancel();
      },
    },
    {
      label: confirmLabel,
      class: confirmClass,
      onClick: () => {
        closeModal();
        if (typeof onConfirmed === 'function') onConfirmed();
      },
    },
  ]);
}

/* ---------- 16. EXCEL IMPORT / EXPORT ---------- */

function importFromXlsx() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array', cellDates: false });
      const result = parseImportedWorkbook(wb);
      const summary = `识别到：\n· ${result.daily.length} 条每日记录\n· ${result.vaccines.length} 条疫苗\n· ${result.visits.length} 次看诊\n· ${result.claims.length} 单理赔\n\n是否合并到现有数据？（同日期的每日记录会被覆盖）`;
      openDeleteConfirmModal({
        title: '从 Excel 导入',
        confirmLabel: '合并导入',
        bodyHtml:
          `<p class="text-sm text-slate-600 whitespace-pre-line">${escapeHtml(summary)}</p>`,
        onConfirmed: () => {
          const byDate = {};
          state.daily.forEach((d) => { byDate[d.date] = d; });
          result.daily.forEach((d) => { byDate[d.date] = d; });
          state.daily = Object.values(byDate).sort((a, b) =>
            (b.date || '').localeCompare(a.date || '')
          );

          state.vaccines = mergeUnique(
            [...state.vaccines, ...result.vaccines],
            (v) => `${v.date}|${v.name}`,
          );
          state.visits = mergeUnique(
            [...state.visits, ...result.visits],
            (v) => `${v.date}|${v.clinic}|${(v.summary || '').slice(0, 20)}`,
          );
          state.claims = mergeUnique(
            [...state.claims, ...result.claims],
            (c) => `${c.date}|${c.insurer}|${c.amount}`,
          );

          saveState();
          toast('导入成功', 'success');
          navigate('dashboard');
        },
      });

    } catch (err) {
      console.error(err);
      toast('导入失败：' + err.message, 'error');
    }
  });
  input.click();
}

function mergeUnique(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  out.sort((a,b) => (b.date||'').localeCompare(a.date||''));
  return out;
}

function xlsxNormalizeSheetTitle(s) {
  return String(s || '').replace(/\s+/g, '');
}

/** 解析单元格日期 -> YYYY-MM-DD */
function parseXlsxDateCell(rawDate) {
  if (rawDate == null || rawDate === '') return null;
  if (typeof rawDate === 'number') return excelSerialToISO(rawDate);
  if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) return rawDate.slice(0, 10);
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) return rawDate.toISOString().slice(0, 10);
  return null;
}

function claimStatusKeyFromCnLabel(txt) {
  const t = String(txt || '').trim();
  if (!t) return 'pending';
  const byLabel = CLAIM_STATUS.find((s) => s.label === t);
  if (byLabel) return byLabel.key;
  const byKey = CLAIM_STATUS.find((s) => s.key === t);
  if (byKey) return byKey.key;
  return 'pending';
}

/** 导出格式「每日记录」：表头含 日期、星期、动态痛苦列、「用药」「大便」「摘要」 */
function parseAppExportedDailySheet(ws) {
  const daily = [];
  if (!ws || !ws['!ref']) return daily;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  if (!rows.length) return daily;

  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = rows[i] || [];
    const labels = cells.map((c) => String(c).trim());
    if (labels.includes('日期') && (labels.includes('摘要') || labels.includes('用药'))) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) return daily;

  const headers = rows[headerRow].map((c) => String(c).trim());
  const col = (lab) => headers.findIndex((h) => h === lab);
  const iDate = col('日期');
  const iWeek = col('星期');
  const iMedsJoined = col('用药');
  const iBowel = col('大便');
  const iSummary = col('摘要');
  if (iDate < 0 || iMedsJoined < 0) return daily;

  const painLabelToMeta = {};
  getAllPainParts().forEach((p) => {
    painLabelToMeta[p.label] = p.key;
    painLabelToMeta[p.key] = p.key;
  });

  const painCols = [];
  const lo = iWeek >= 0 ? iWeek + 1 : iDate + 1;
  for (let c = lo; c < iMedsJoined; c++) {
    const lab = headers[c];
    if (!lab) continue;
    painCols.push({ col: c, key: painLabelToMeta[lab] || lab });
  }

  const medLabels = {};
  getAllMedItems().forEach((m) => {
    medLabels[m.label] = m.key;
  });

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const iso = parseXlsxDateCell(row[iDate]);
    if (!iso) continue;

    const pains = {};
    for (const { col: ci, key } of painCols) {
      const p = parsePainText(row[ci]);
      if (p !== null && p > 0) pains[key] = Math.round(p);
    }

    const meds = {};
    const customMeds = [];
    const medsStr = String(row[iMedsJoined] || '');
    medsStr
      .split(/[,，、\n]/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((label) => {
        const k = medLabels[label];
        if (k) meds[k] = true;
        else customMeds.push(label);
      });

    const bowel = iBowel >= 0 ? String(row[iBowel] || '').trim() : '';
    const summary = iSummary >= 0 ? String(row[iSummary] || '').trim() : '';

    if (
      !summary
      && !bowel
      && !Object.keys(pains).length
      && !Object.keys(meds).length
      && !customMeds.length
    ) continue;

    daily.push({
      id: uid(),
      date: iso,
      pains,
      meds,
      customMeds,
      bowel,
      summary,
      tags: [],
    });
  }
  return daily;
}

/** 导出格式「疫苗记录」：日期 · 疫苗名称 · 剂次 · 效期 · 接种地点 · 备注 */
function parseAppExportedVaccinesSheet(ws) {
  const list = [];
  if (!ws || !ws['!ref']) return list;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  if (rows.length < 2) return list;
  const h = rows[0].map((c) => String(c).trim());
  const ix = {
    date: h.indexOf('日期'),
    name: h.indexOf('疫苗名称'),
    dose: h.indexOf('剂次'),
    duration: h.indexOf('效期'),
    location: h.indexOf('接种地点'),
    notes: h.indexOf('备注'),
  };
  if (ix.date < 0 || ix.name < 0) return list;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const iso = parseXlsxDateCell(row[ix.date]);
    const name = ix.name >= 0 ? String(row[ix.name] || '').trim() : '';
    if (!iso || !name) continue;
    list.push({
      id: uid(),
      date: iso,
      name,
      dose: ix.dose >= 0 ? String(row[ix.dose] || '').trim() : '',
      duration: ix.duration >= 0 ? String(row[ix.duration] || '').trim() : '',
      location: ix.location >= 0 ? String(row[ix.location] || '').trim() : '',
      notes: ix.notes >= 0 ? String(row[ix.notes] || '').trim() : '',
    });
  }
  return list;
}

/** 导出格式「看诊记录」 */
function parseAppExportedVisitsSheet(ws) {
  const list = [];
  if (!ws || !ws['!ref']) return list;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  if (rows.length < 2) return list;
  const h = rows[0].map((c) => String(c).trim());
  const ix = {
    date: h.indexOf('日期'),
    clinic: h.indexOf('科室'),
    doctor: h.indexOf('医师'),
    summary: h.indexOf('看诊小结'),
    prescription: h.indexOf('用药/处置'),
    followUp: h.indexOf('回诊'),
  };
  if (ix.date < 0 || ix.clinic < 0) return list;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const iso = parseXlsxDateCell(row[ix.date]);
    const clinic = String(row[ix.clinic] || '').trim();
    if (!iso || !clinic) continue;
    list.push({
      id: uid(),
      date: iso,
      clinic,
      doctor: ix.doctor >= 0 ? String(row[ix.doctor] || '').trim() : '',
      summary: ix.summary >= 0 ? String(row[ix.summary] || '').trim() : '',
      prescription: ix.prescription >= 0 ? String(row[ix.prescription] || '').trim() : '',
      followUp: ix.followUp >= 0 ? String(row[ix.followUp] || '').trim() : '',
    });
  }
  return list;
}

/** 导出格式「理赔记录」——状态列为中文标签，需换回 key */
function parseAppExportedClaimsSheet(ws) {
  const list = [];
  if (!ws || !ws['!ref']) return list;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  if (rows.length < 2) return list;
  const h = rows[0].map((c) => String(c).trim());
  const ix = {
    date: h.indexOf('日期'),
    insurer: h.indexOf('保险'),
    type: h.indexOf('类型'),
    amount: h.indexOf('金额'),
    status: h.indexOf('状态'),
    description: h.indexOf('说明'),
  };
  if (ix.date < 0 || ix.insurer < 0 || ix.amount < 0) return list;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const iso = parseXlsxDateCell(row[ix.date]);
    const insurer = String(row[ix.insurer] || '').trim();
    const rawAmt = row[ix.amount];
    if (!iso || !insurer || rawAmt == null || rawAmt === '') continue;
    const amount = typeof rawAmt === 'number'
      ? rawAmt
      : parseFloat(String(rawAmt).replace(/[^\d.\-]/g, ''));
    if (!amount || !isFinite(amount)) continue;
    list.push({
      id: uid(),
      date: iso,
      insurer,
      type: ix.type >= 0 ? String(row[ix.type] || '').trim() : '',
      amount,
      description: ix.description >= 0 ? String(row[ix.description] || '').trim() : '',
      status: claimStatusKeyFromCnLabel(ix.status >= 0 ? row[ix.status] : ''),
    });
  }
  return list;
}

/** 单片：旧「就医头痛记录表」同款（单列 / 单行表头）；不含本 App 多 sheet 导出 */
function parseLegacySingleSheet(ws) {
  const out = { daily: [], vaccines: [], visits: [], claims: [] };
  if (!ws || !ws['!ref']) return out;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  if (!rows.length) return out;

  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    if (rows[i].some((c) => String(c).trim() === '日期')) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) return out;

  const headers = rows[headerRow].map((c) => String(c).trim());
  const colOf = (label) => headers.findIndex((h) => h === label);

  const idx = {
    date: colOf('日期'),
    week: colOf('星期'),
    vaccine: colOf('疫苗'),
    headache: colOf('头痛'),
    back: colOf('腰背痛'),
    tail: colOf('尾骨'),
    mood: colOf('情绪'),
    tookMed: colOf('吃药'),
    liFeiYa: colOf('利飞亚'),
    luoShaTeng: colOf('罗莎疼'),
    coldMed: colOf('感冒药'),
    bowel: colOf('大便'),
    ointment: colOf('清凉药膏'),
    summary: colOf('摘要'),
    tcm: colOf('中医'),
    ent: colOf('耳鼻'),
    dental: colOf('牙科'),
    eye: colOf('眼科'),
    thyroid: colOf('甲状'),
    rehab: colOf('复健'),
    neuro: colOf('神内'),
    gyn: colOf('妇产'),
    breast: colOf('乳房'),
    surg: colOf('外科'),
    gi: colOf('胃肠'),
    chest: colOf('胸腔'),
    psych: colOf('身心'),
    nanshan: colOf('南山理赔'),
    global: colOf('全球理赔'),
    health: colOf('健保局'),
  };

  const clinicMap = [
    ['tcm', '中医'],
    ['ent', '耳鼻'],
    ['dental', '牙科'],
    ['eye', '眼科'],
    ['thyroid', '甲状'],
    ['rehab', '复健'],
    ['neuro', '神内'],
    ['gyn', '妇产'],
    ['breast', '乳房'],
    ['surg', '外科'],
    ['gi', '胃肠'],
    ['chest', '胸腔'],
    ['psych', '身心'],
  ];

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const rawDate = row[idx.date];
    const iso = parseXlsxDateCell(rawDate);
    if (!iso) continue;

    const vac = row[idx.vaccine];
    if (vac && String(vac).trim() && idx.vaccine >= 0) {
      out.vaccines.push({
        id: uid(),
        date: iso,
        name: String(vac).trim(),
        dose: '',
        duration: '',
        location: '',
        notes: '',
      });
    }

    const summary = idx.summary >= 0 ? String(row[idx.summary] || '').trim() : '';
    const pains = {};
    const setPain = (key, colIndex) => {
      if (colIndex < 0) return;
      const p = parsePainText(row[colIndex]);
      if (p !== null && p > 0) pains[key] = Math.round(p);
    };
    setPain('headache', idx.headache);
    setPain('backPain', idx.back);
    setPain('tailbone', idx.tail);
    setPain('mood', idx.mood);

    const meds = {};
    const setMed = (key, colIndex) => {
      if (colIndex < 0) return;
      const v = row[colIndex];
      if (v != null && String(v).trim() && String(v).trim() !== '0') meds[key] = true;
    };
    setMed('liFeiYa', idx.liFeiYa);
    setMed('luoShaTeng', idx.luoShaTeng);
    setMed('coldMed', idx.coldMed);
    setMed('ointment', idx.ointment);

    const bowel = idx.bowel >= 0 ? String(row[idx.bowel] || '').trim() : '';

    if (summary || Object.keys(pains).length || Object.keys(meds).length || bowel) {
      out.daily.push({
        id: uid(),
        date: iso,
        pains,
        meds,
        customMeds: [],
        bowel,
        summary,
        tags: [],
      });
    }

    for (const [k, name] of clinicMap) {
      const c = idx[k];
      if (c < 0) continue;
      const txt = String(row[c] || '').trim();
      if (!txt) continue;
      out.visits.push({
        id: uid(),
        date: iso,
        clinic: name,
        doctor: '',
        summary: txt,
        prescription: '',
        followUp: '',
      });
    }

    const addClaim = (colIndex, insurer) => {
      if (colIndex < 0) return;
      const v = row[colIndex];
      if (v == null || v === '') return;
      const amt = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
      if (!amt || !isFinite(amt)) return;
      out.claims.push({
        id: uid(),
        date: iso,
        insurer,
        type: '',
        amount: amt,
        description: '',
        status: 'paid',
      });
    };
    addClaim(idx.nanshan, '南山');
    addClaim(idx.global, '全球');
    addClaim(idx.health, '健保局');
  }

  return out;
}

/**
 * 合并：优先按工作表名称读取「本 App 导出」四表；
 * 其余工作表仍尝试旧 Excel 单列格式。
 */
function parseImportedWorkbook(wb) {
  const out = { daily: [], vaccines: [], visits: [], claims: [] };
  const names = wb.SheetNames || [];
  const handled = new Set();

  const findSn = (...titles) => {
    const normTitles = titles.map(xlsxNormalizeSheetTitle);
    for (let ti = 0; ti < titles.length; ti++) {
      const n = names.find(
        (sn) => sn === titles[ti] || xlsxNormalizeSheetTitle(sn) === normTitles[ti],
      );
      if (n) return n;
    }
    return null;
  };

  const snDaily = findSn('每日记录');
  if (snDaily) {
    out.daily = parseAppExportedDailySheet(wb.Sheets[snDaily]);
    handled.add(snDaily);
  }
  const snVac = findSn('疫苗记录');
  if (snVac) {
    out.vaccines = parseAppExportedVaccinesSheet(wb.Sheets[snVac]);
    handled.add(snVac);
  }
  const snVis = findSn('看诊记录');
  if (snVis) {
    out.visits = parseAppExportedVisitsSheet(wb.Sheets[snVis]);
    handled.add(snVis);
  }
  const snClm = findSn('理赔记录');
  if (snClm) {
    out.claims = parseAppExportedClaimsSheet(wb.Sheets[snClm]);
    handled.add(snClm);
  }

  for (const sn of names) {
    if (handled.has(sn)) continue;
    const ws = wb.Sheets[sn];
    if (!ws || !ws['!ref']) continue;
    const probeRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    if (!probeRows.length) continue;
    let hdrLine = null;
    for (let i = 0; i < Math.min(probeRows.length, 20); i++) {
      const rr = probeRows[i];
      if (rr && rr.some((c) => String(c).trim() === '日期')) {
        hdrLine = rr.map((c) => String(c).trim());
        break;
      }
    }
    /* 以下判断用于：工作表被改名或未按原名识别时，仍可按导出列头识别 */
    if (
      hdrLine
      && hdrLine.includes('星期')
      && hdrLine.includes('用药')
      && hdrLine.includes('摘要')
      && !hdrLine.includes('疫苗名称')
      && !hdrLine.includes('南山理赔')
    ) {
      out.daily.push(...parseAppExportedDailySheet(ws));
      continue;
    }
    if (
      hdrLine
      && hdrLine.includes('疫苗名称')
      && hdrLine.includes('接种地点')
    ) {
      out.vaccines.push(...parseAppExportedVaccinesSheet(ws));
      continue;
    }
    if (
      hdrLine
      && hdrLine.includes('科室')
      && hdrLine.includes('看诊小结')
    ) {
      out.visits.push(...parseAppExportedVisitsSheet(ws));
      continue;
    }
    if (
      hdrLine
      && hdrLine.includes('保险')
      && hdrLine.includes('金额')
      && hdrLine.includes('状态')
    ) {
      out.claims.push(...parseAppExportedClaimsSheet(ws));
      continue;
    }
    const chunk = parseLegacySingleSheet(ws);
    out.daily.push(...chunk.daily);
    out.vaccines.push(...chunk.vaccines);
    out.visits.push(...chunk.visits);
    out.claims.push(...chunk.claims);
  }

  return out;
}

function exportToXlsx() {
  const wb = XLSX.utils.book_new();

  // Daily — dynamic columns so user's custom pains/meds also export
  const painCols = getAllPainParts();
  const dailyHeader = ['日期', '星期', ...painCols.map(p => p.label), '用药', '大便', '摘要'];
  const dailyRows = state.daily.map(d => {
    const meds = [
      ...getAllMedItems().filter(m => d.meds?.[m.key]).map(m => m.label),
      ...(d.customMeds || [])
    ].join('、');
    const week = ['日','一','二','三','四','五','六'][new Date(d.date).getDay()];
    return [
      d.date, '周' + week,
      ...painCols.map(p => d.pains?.[p.key] || ''),
      meds, d.bowel || '', d.summary || ''
    ];
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([dailyHeader, ...dailyRows]), '每日记录');

  // Vaccines
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['日期','疫苗名称','剂次','效期','接种地点','备注'],
    ...state.vaccines.map(v => [v.date, v.name, v.dose, v.duration, v.location, v.notes])
  ]), '疫苗记录');

  // Visits
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['日期','科室','医师','看诊小结','用药/处置','回诊'],
    ...state.visits.map(v => [v.date, v.clinic, v.doctor, v.summary, v.prescription, v.followUp])
  ]), '看诊记录');

  // Claims
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['日期','保险','类型','金额','状态','说明'],
    ...state.claims.map(c => [
      c.date, c.insurer, c.type, c.amount,
      (CLAIM_STATUS.find(s => s.key === c.status) || {}).label || c.status, c.description
    ])
  ]), '理赔记录');

  const filename = `健康档案_${todayStr()}.xlsx`;
  XLSX.writeFile(wb, filename);
  toast('已导出 ' + filename, 'success');
}

function exportToJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `健康档案备份_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('已导出 JSON 备份', 'success');
}

function importFromJson() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object') throw new Error('文件格式不正确');
      openDeleteConfirmModal({
        title: '从 JSON 恢复',
        confirmLabel: '覆盖恢复',
        bodyHtml:
          '<p class="text-sm text-slate-600">确定用文件<strong>完整覆盖</strong>本机档案？建议先<strong>导出备份</strong>。此操作<strong>不可撤销</strong>。</p>',
        onConfirmed: () => {
          state = { ...defaultState(), ...data };
          saveState();
          applyUiFontScaleFromState();
          toast('已恢复', 'success');
          navigate('dashboard');
        },
      });
    } catch (err) {
      toast('导入失败：' + err.message, 'error');
    }
  });
  input.click();
}

/* ---------- 17. PWA INSTALL ---------- */

let _deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredPrompt = e;
});
function promptInstall() {
  if (_deferredPrompt) {
    _deferredPrompt.prompt();
    _deferredPrompt = null;
  } else {
    alert('要将此应用"安装"到手机主屏幕：\n\n📱 iPhone (Safari)：点击底部分享按钮 → 添加到主屏幕\n📱 Android (Chrome)：右上角菜单 → 添加到主屏幕 / 安装应用\n💻 桌面 (Chrome/Edge)：地址栏右侧的"安装"图标');
  }
}

// Register service worker if available
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {/* ok offline disabled */});
  });
}

/* ---------- 18. BOOT ---------- */

function bindGlobalNav() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.page;
      if (p === 'quickAdd') {
        navigate('dailyEdit', { date: todayStr() });
      } else if (p) {
        navigate(p);
      }
    });
  });
  $('#searchBtn').addEventListener('click', () => navigate('search'));
}

function showWelcomeIfEmpty() {
  if (state.daily.length || state.vaccines.length || state.visits.length || state.claims.length) return;
  openModal('欢迎使用 · 张婷要健康', `
    <div class="space-y-3 text-sm text-slate-600">
      <p>这是一个把你 Excel 表里的健康数据数字化的小应用。</p>
      <p>你可以做的事：</p>
      <ul class="list-disc list-inside space-y-1 text-slate-700">
        <li>每天用滑块快速记录身体不适和用药</li>
        <li>记录每次疫苗、看诊、保险理赔</li>
        <li>查看图表分析身体趋势</li>
        <li>从你现有的 Excel 一键导入历史数据</li>
      </ul>
      <p class="text-xs text-slate-500 mt-3">默认数据只在本机浏览器。若已配置云端同步，会与你的私人服务器备份相同步。</p>
    </div>
  `, [
    { label: '从 Excel 导入历史', class: 'btn-ghost', onClick: () => { closeModal(); importFromXlsx(); } },
    { label: '直接开始',           class: 'btn-primary', onClick: closeModal }
  ]);
}

document.addEventListener('DOMContentLoaded', async () => {
  bindGlobalNav();
  const seeded = await tryApplyBundledSeedIfFresh();
  if (seeded) {
    applyUiFontScaleFromState();
    toast('已从网站载入起始档案（已保存到本机）', 'success');
  }
  await bootstrapCloudPullOnce();
  startCloudAutoPull();
  navigate('dashboard');
  showWelcomeIfEmpty();
});
