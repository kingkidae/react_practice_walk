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
