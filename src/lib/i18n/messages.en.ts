/**
 * English Messages (Placeholder for future implementation)
 *
 * This file provides English translations.
 * Currently marked as TODO - will be implemented when English support is needed.
 */

import type { Messages } from "./messages.ko";

export const messages: Messages = {
	errors: {
		// Team errors
		TEAM_NOT_FOUND: "Team not found",
		TEAM_ACCESS_DENIED: "You do not have access to this team",
		TEAM_ADMIN_REQUIRED: "Team admin access required",
		TEAM_OWNER_REQUIRED: "Team owner access required",
		TEAM_MEMBER_NOT_FOUND: "Team member not found",
		TEAM_MEMBER_ALREADY_EXISTS: "User is already a team member",
		TEAM_OWNER_CANNOT_LEAVE: "Team owner cannot leave the team",
		TEAM_CANNOT_CHANGE_OWN_ROLE: "You cannot change your own role",
		TEAM_NEW_OWNER_NOT_EXIST: "New owner does not exist",

		// Project errors
		PROJECT_NOT_FOUND: "Project not found",
		PROJECT_ACCESS_DENIED: "You do not have access to this project",
		PROJECT_MEMBER_NOT_FOUND: "Project member not found",
		PROJECT_MEMBER_ALREADY_EXISTS: "User is already a project member",
		PROJECT_MEMBER_CANNOT_REMOVE_SELF:
			"You cannot remove yourself from the project",
		PROJECT_TEAM_ADMIN_REQUIRED: "Team admin access required",
		PROJECT_USER_NOT_FOUND: "User not found",

		// API Key errors
		API_KEY_NOT_FOUND: "API key not found",
		API_KEY_ALREADY_DISABLED: "API key is already disabled",
		API_KEY_ALREADY_ACTIVE: "API key is already active",
		API_KEY_INVALID_FORMAT: "Invalid API key format",
		API_KEY_DELETION_REASON_REQUIRED: "Deletion reason is required",
		API_KEY_DISABLE_REASON_REQUIRED: "Disable reason is required",
		ADMIN_KEY_NOT_FOUND: "Admin API key not found",
		ADMIN_KEY_REGISTER_PERMISSION_DENIED:
			"Only team owners/admins can register Admin API keys",

		// Validation errors
		VALIDATION_REASON_TOO_LONG: "Reason must be 500 characters or less",
		VALIDATION_NAME_TOO_LONG: "Name must be 100 characters or less",
		VALIDATION_EMAIL_INVALID: "Please enter a valid email address",
		VALIDATION_REQUIRED_FIELD: "This field is required",

		// Auth errors
		AUTH_USER_ALREADY_EXISTS: "User with this email already exists",
		AUTH_INVALID_CREDENTIALS: "Invalid email or password",
		AUTH_USER_NOT_FOUND: "User not found",

		// Cost errors
		COST_TEAM_ACCESS_DENIED: "You do not have access to this team's cost data",

		// Generic errors
		INTERNAL_SERVER_ERROR:
			"An error occurred on the server. Please try again later.",
		UNAUTHORIZED: "Authentication required",
		FORBIDDEN: "Access denied",
		USER_NOT_FOUND: "User not found",
	},

	common: {
		save: "Save",
		cancel: "Cancel",
		delete: "Delete",
		edit: "Edit",
		create: "Create",
		search: "Search",
		filter: "Filter",
		loading: "Loading...",
		noData: "No data available",
		confirm: "Confirm",
		back: "Back",
		next: "Next",
		previous: "Previous",
		submit: "Submit",
		close: "Close",
	},

	auth: {
		login: "Login",
		logout: "Logout",
		signup: "Sign Up",
		email: "Email",
		password: "Password",
		name: "Name",
		loginButton: "Log In",
		signupButton: "Sign Up",
		forgotPassword: "Forgot password?",
		alreadyHaveAccount: "Already have an account?",
		dontHaveAccount: "Don't have an account?",
	},

	team: {
		title: "Teams",
		createTeam: "Create Team",
		teamName: "Team Name",
		teamBudget: "Team Budget",
		members: "Members",
		addMember: "Add Member",
		removeMember: "Remove Member",
		role: "Role",
		owner: "Owner",
		admin: "Admin",
		member: "Member",
	},

	project: {
		title: "Projects",
		createProject: "Create Project",
		projectName: "Project Name",
		description: "Description",
		apiKeys: "API Keys",
		addApiKey: "Add API Key",
		deleteApiKey: "Delete API Key",
		disableApiKey: "Disable API Key",
		enableApiKey: "Enable API Key",
		reason: "Reason",
		provider: "Provider",
	},

	cost: {
		title: "Costs",
		totalCost: "Total Cost",
		yesterdayCost: "Yesterday's Cost",
		thisWeekCost: "This Week's Cost",
		thisMonthCost: "This Month's Cost",
		costByTeam: "Cost by Team",
		costByProject: "Cost by Project",
		costTrend: "Cost Trend",
	},

	validation: {
		required: "This field is required",
		emailInvalid: "Please enter a valid email address",
		passwordTooShort: "Password must be at least 8 characters",
		nameTooLong: "Name must be 100 characters or less",
		reasonTooLong: "Reason must be 500 characters or less",
	},

	captcha: {
		verifying: "Verifying security...",
		verificationFailed: "Security verification failed. Please try again.",
		verificationError: "An error occurred during CAPTCHA verification.",
		tokenRequired: "CAPTCHA token is required",
		signingIn: "Signing in...",
		creatingAccount: "Creating account...",
		loginFailed: "Login failed",
		signupFailed: "Signup failed",
		loginSuccess: "Login successful!",
		signupSuccess: "Signup successful!",
	},
} as const;
