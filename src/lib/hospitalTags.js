// 공공데이터에는 진료 과목/전문 분야 필드가 없으므로,
// 병원 이름에 들어 있는 단어로 특징을 추정한다. (화면에 "이름 기준 추정"으로 표시)
const RULES = [
  { tag: '24시·응급', re: /24\s*시|24h|응급|야간|ER\b/i },
  { tag: '대형·2차 진료', re: /메디컬\s*센터|의료\s*센터|의료원|종합|2차|medical|센터/i },
  { tag: '고양이', re: /고양이|캣|cat|냥|feline/i },
  { tag: '특수동물', re: /특수동물|엑조틱|exotic|조류|파충류|토끼|햄스터|버드|bird/i },
  { tag: '치과', re: /치과|dental/i },
  { tag: '안과', re: /안과|eye|ophthal/i },
  { tag: '피부', re: /피부|derma/i },
  { tag: '정형·재활', re: /정형|관절|재활|척추|ortho|rehab/i },
  { tag: '한방', re: /한방|침술|acupunct/i },
  { tag: '심장', re: /심장|cardio/i },
  { tag: '내과', re: /내과/ },
  { tag: '외과', re: /(?<!정형)외과|surg/i },
  { tag: '행동 클리닉', re: /행동|behavior/i },
]

export function hospitalTags(name) {
  return RULES.filter((r) => r.re.test(name)).map((r) => r.tag)
}

export const TAG_FILTERS = ['24시·응급', '대형·2차 진료', '고양이', '특수동물', '치과', '안과', '정형·재활', '한방']

// 동물약국·미용·위탁관리: 이름에 들어 있는 단어로 특징 추정
const PLACE_RULES = {
  pharmacy: [
    { tag: '동물 전문 약국', re: /동물|펫|pet|애견|반려/i },
    { tag: '24시', re: /24\s*시|24h|심야|야간/i },
  ],
  grooming: [
    { tag: '고양이 미용', re: /고양이|캣|cat|냥|feline/i },
    { tag: '스파·목욕', re: /스파|spa|목욕|아쿠아|탄산/i },
    { tag: '호텔 겸업', re: /호텔|hotel|유치원|데이케어/i },
    { tag: '1인·예약제', re: /1인|예약|프라이빗|private/i },
  ],
  care: [
    { tag: '호텔', re: /호텔|hotel|스테이|stay|펜션/i },
    { tag: '유치원·데이케어', re: /유치원|데이케어|daycare|스쿨|school|놀이방/i },
    { tag: '고양이', re: /고양이|캣|cat|냥/i },
    { tag: '훈련', re: /훈련|트레이닝|training|교육|아카데미/i },
    { tag: '대형견', re: /대형견|리트리버|큰개/i },
  ],
}
export function placeTags(type, name) {
  if (type === 'hospital') return hospitalTags(name)
  return (PLACE_RULES[type] || []).filter((r) => r.re.test(name)).map((r) => r.tag)
}
export const TAG_FILTERS_BY_TYPE = {
  hospital: TAG_FILTERS,
  pharmacy: ['동물 전문 약국', '24시'],
  grooming: ['고양이 미용', '스파·목욕', '호텔 겸업', '1인·예약제'],
  care: ['호텔', '유치원·데이케어', '고양이', '훈련', '대형견'],
}
