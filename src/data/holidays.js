// 祝日 ･ 学校休暇の判定。表示範囲が今日 + 14 日なので網羅性は当年中心で十分。
// 祝日は内閣府公表に基づき手で持つ (2025-12 〜 2027-01 をカバー、振替休日含む)。

import { isWeekend, weekdayIndex } from '../utils/date.js';

export const HOLIDAYS = {
  // 2025 年末
  '2025-12-31': '大晦日',
  // 2026 年
  '2026-01-01': '元日',
  '2026-01-12': '成人の日',
  '2026-02-11': '建国記念の日',
  '2026-02-23': '天皇誕生日',
  '2026-03-20': '春分の日',
  '2026-04-29': '昭和の日',
  '2026-05-03': '憲法記念日',
  '2026-05-04': 'みどりの日',
  '2026-05-05': 'こどもの日',
  '2026-05-06': '振替休日',
  '2026-07-20': '海の日',
  '2026-08-11': '山の日',
  '2026-09-21': '敬老の日',
  '2026-09-22': '国民の休日',
  '2026-09-23': '秋分の日',
  '2026-10-12': 'スポーツの日',
  '2026-11-03': '文化の日',
  '2026-11-23': '勤労感謝の日',
  // 2027 年始
  '2027-01-01': '元日',
};

// 学校休暇 (一般的な目安。年に依らず月日で判定)
const VACATIONS = [
  { name: '春休み', from: '03-25', to: '04-07' },
  { name: 'GW', from: '04-29', to: '05-06' },
  { name: '夏休み', from: '07-21', to: '08-31' },
  { name: '冬休み', from: '12-25', to: '01-07' },
];

export function holidayName(dateStr) {
  return HOLIDAYS[dateStr] || null;
}

export function isHoliday(dateStr) {
  return dateStr in HOLIDAYS;
}

// 学校休暇区分 (春休み / GW / 夏休み / 冬休み) を返す。該当しなければ null。
export function schoolVacation(dateStr) {
  const md = dateStr.slice(5); // 'MM-DD'
  for (const v of VACATIONS) {
    if (v.from <= v.to) {
      if (md >= v.from && md <= v.to) return v.name;
    } else {
      // 年をまたぐ期間 (冬休み)
      if (md >= v.from || md <= v.to) return v.name;
    }
  }
  return null;
}

// 日付区分をまとめて返す
export function dayType(dateStr) {
  const hol = holidayName(dateStr);
  const weekend = isWeekend(dateStr);
  return {
    isHoliday: hol != null,
    holidayName: hol,
    vacation: schoolVacation(dateStr),
    isWeekend: weekend,
    weekdayIndex: weekdayIndex(dateStr),
    // 休日 = 土日 or 祝日
    isOff: weekend || hol != null,
  };
}
