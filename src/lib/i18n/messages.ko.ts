/**
 * Korean (한국어) Messages
 *
 * All Korean translations for the application.
 * This file re-exports ERROR_MESSAGES and adds UI messages.
 */

import { ERROR_MESSAGES } from "../error-messages";

export const messages = {
	// Error messages from centralized constants
	errors: ERROR_MESSAGES,

	// Common UI messages
	common: {
		save: "저장",
		cancel: "취소",
		delete: "삭제",
		edit: "수정",
		create: "생성",
		search: "검색",
		filter: "필터",
		loading: "로딩 중...",
		noData: "데이터가 없습니다",
		confirm: "확인",
		back: "뒤로",
		next: "다음",
		previous: "이전",
		submit: "제출",
		close: "닫기",
	},

	// Auth messages
	auth: {
		login: "로그인",
		logout: "로그아웃",
		signup: "회원가입",
		email: "이메일",
		password: "비밀번호",
		name: "이름",
		loginButton: "로그인",
		signupButton: "가입하기",
		forgotPassword: "비밀번호를 잊으셨나요?",
		alreadyHaveAccount: "이미 계정이 있으신가요?",
		dontHaveAccount: "계정이 없으신가요?",
	},

	// Team messages
	team: {
		title: "팀",
		createTeam: "팀 생성",
		teamName: "팀 이름",
		teamBudget: "팀 예산",
		members: "멤버",
		addMember: "멤버 추가",
		removeMember: "멤버 제거",
		role: "역할",
		owner: "소유자",
		admin: "관리자",
		member: "멤버",
	},

	// Project messages
	project: {
		title: "프로젝트",
		createProject: "프로젝트 생성",
		projectName: "프로젝트 이름",
		description: "설명",
		apiKeys: "API 키",
		addApiKey: "API 키 추가",
		deleteApiKey: "API 키 삭제",
		disableApiKey: "API 키 비활성화",
		enableApiKey: "API 키 활성화",
		reason: "사유",
		provider: "제공자",
	},

	// Cost messages
	cost: {
		title: "비용",
		totalCost: "총 비용",
		yesterdayCost: "어제 비용",
		thisWeekCost: "이번 주 비용",
		thisMonthCost: "이번 달 비용",
		costByTeam: "팀별 비용",
		costByProject: "프로젝트별 비용",
		costTrend: "비용 추이",
	},

	// Validation messages (for forms)
	validation: {
		required: "필수 입력 항목입니다",
		emailInvalid: "올바른 이메일 주소를 입력해주세요",
		passwordTooShort: "비밀번호는 최소 8자 이상이어야 합니다",
		nameTooLong: "이름은 100자 이내로 입력해주세요",
		reasonTooLong: "사유는 500자 이내로 입력해주세요",
	},

	// CAPTCHA messages
	captcha: {
		verifying: "보안 검증 중...",
		verificationFailed: "보안 검증에 실패했습니다. 다시 시도해주세요.",
		verificationError: "CAPTCHA 검증 중 오류가 발생했습니다.",
		tokenRequired: "CAPTCHA token is required",
		signingIn: "로그인 중...",
		creatingAccount: "계정 생성 중...",
		loginFailed: "로그인 실패",
		signupFailed: "회원가입 실패",
		loginSuccess: "로그인 성공!",
		signupSuccess: "회원가입 성공!",
	},
} as const;

// Extract the structure but allow different string values
export type Messages = {
	[K in keyof typeof messages]: (typeof messages)[K] extends Record<
		string,
		string
	>
		? Record<keyof (typeof messages)[K], string>
		: (typeof messages)[K];
};
