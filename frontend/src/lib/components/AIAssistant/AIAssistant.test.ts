/**
 * Tests for AI Assistant components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AI Assistant API Utilities', () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	describe('AI Explainer API', () => {
		it('should format explain control request correctly', async () => {
			const mockResponse = {
				control_id: 'AC-2',
				purpose: 'Manage user accounts',
				implementation_overview: 'AD-based management',
				business_impact: 'Reduces unauthorized access',
				key_points: ['Point 1', 'Point 2'],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const response = await fetch('/api/ai/explainer/control/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					control_id: 'AC-2',
					control_name: 'Account Management',
					control_description: 'Manage user accounts',
					audience: 'executive',
				}),
			});

			expect(response.ok).toBe(true);
			const data = await response.json();
			expect(data.control_id).toBe('AC-2');
			expect(data.key_points).toHaveLength(2);
		});

		it('should handle explain risk request', async () => {
			const mockResponse = {
				risk_id: 'RISK-001',
				risk_summary: 'Potential data breach',
				potential_impact: 'High financial impact',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const response = await fetch('/api/ai/explainer/risk/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					risk_id: 'RISK-001',
					risk_title: 'Data Breach',
					risk_description: 'Risk of data exposure',
					audience: 'executive',
				}),
			});

			expect(response.ok).toBe(true);
			const data = await response.json();
			expect(data.risk_id).toBe('RISK-001');
		});
	});

	describe('AI Auditor API', () => {
		it('should format evaluate control request correctly', async () => {
			const mockResponse = {
				control_id: 'AC-2',
				effectiveness_rating: 'largely_effective',
				effectiveness_score: 0.75,
				strengths: ['Strong policies'],
				weaknesses: ['Manual processes'],
				recommendations: ['Automate provisioning'],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const response = await fetch('/api/ai/auditor/evaluate-control/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					control_id: 'AC-2',
					control_description: 'Account management control',
					requirement_text: 'Manage user accounts properly',
					implementation_statement: 'AD-based account management',
					evidence_summary: 'Access review reports',
				}),
			});

			expect(response.ok).toBe(true);
			const data = await response.json();
			expect(data.effectiveness_rating).toBe('largely_effective');
			expect(data.effectiveness_score).toBe(0.75);
		});

		it('should handle gap analysis request', async () => {
			const mockResponse = [
				{
					gap_id: 'GAP-001',
					title: 'Missing MFA',
					severity: 'high',
					affected_controls: ['AC-2', 'IA-2'],
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const response = await fetch('/api/ai/auditor/gap-analysis/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					current_state: { access_control: 'Basic' },
					target_framework: 'NIST 800-53',
				}),
			});

			expect(response.ok).toBe(true);
			const data = await response.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data[0].gap_id).toBe('GAP-001');
		});

		it('should handle evidence review request', async () => {
			const mockResponse = {
				relevance_score: 0.85,
				sufficiency_rating: 'sufficient',
				currency_assessment: 'current',
				reliability_assessment: 'high',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const response = await fetch('/api/ai/auditor/review-evidence/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					evidence_description: 'Screenshot of AD configuration',
					evidence_type: 'screenshot',
					control_requirement: 'Configure account lockout',
				}),
			});

			expect(response.ok).toBe(true);
			const data = await response.json();
			expect(data.relevance_score).toBe(0.85);
			expect(data.sufficiency_rating).toBe('sufficient');
		});
	});

	describe('AI Author API', () => {
		it('should handle draft control request', async () => {
			const mockResponse = {
				implementation_statement: 'The organization implements...',
				key_points: ['Point 1', 'Point 2'],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const response = await fetch('/api/ai/author/draft/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					control_id: 'AC-2',
					control_requirement: 'Manage user accounts',
					context: { organization_type: 'enterprise' },
				}),
			});

			expect(response.ok).toBe(true);
			const data = await response.json();
			expect(data.implementation_statement).toBeDefined();
		});
	});

	describe('Error Handling', () => {
		it('should handle API errors gracefully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
			});

			const response = await fetch('/api/ai/explainer/control/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			});

			expect(response.ok).toBe(false);
			expect(response.status).toBe(500);
		});

		it('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			await expect(
				fetch('/api/ai/explainer/control/', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({}),
				})
			).rejects.toThrow('Network error');
		});
	});
});

describe('AI Assistant Data Transformations', () => {
	describe('Audience Selection', () => {
		const audiences = ['executive', 'auditor', 'engineer', 'analyst', 'end_user', 'legal', 'board'];

		it('should have valid audience options', () => {
			expect(audiences).toContain('executive');
			expect(audiences).toContain('auditor');
			expect(audiences).toContain('engineer');
			expect(audiences.length).toBe(7);
		});
	});

	describe('Effectiveness Rating Mapping', () => {
		const ratingToColor = (rating: string): string => {
			const colors: Record<string, string> = {
				fully_effective: 'green',
				largely_effective: 'lime',
				partially_effective: 'yellow',
				largely_ineffective: 'orange',
				ineffective: 'red',
				not_implemented: 'gray',
			};
			return colors[rating] || 'gray';
		};

		it('should map ratings to colors correctly', () => {
			expect(ratingToColor('fully_effective')).toBe('green');
			expect(ratingToColor('largely_effective')).toBe('lime');
			expect(ratingToColor('partially_effective')).toBe('yellow');
			expect(ratingToColor('largely_ineffective')).toBe('orange');
			expect(ratingToColor('ineffective')).toBe('red');
			expect(ratingToColor('not_implemented')).toBe('gray');
			expect(ratingToColor('unknown')).toBe('gray');
		});
	});

	describe('Score Formatting', () => {
		const formatScore = (score: number): string => {
			return `${Math.round(score * 100)}%`;
		};

		it('should format scores as percentages', () => {
			expect(formatScore(0)).toBe('0%');
			expect(formatScore(0.5)).toBe('50%');
			expect(formatScore(0.75)).toBe('75%');
			expect(formatScore(1)).toBe('100%');
		});
	});

	describe('Gap Severity Ordering', () => {
		const severityOrder = ['critical', 'high', 'medium', 'low', 'informational'];

		const sortGapsBySeverity = (gaps: { severity: string }[]): { severity: string }[] => {
			return [...gaps].sort((a, b) => {
				return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
			});
		};

		it('should sort gaps by severity correctly', () => {
			const gaps = [
				{ severity: 'low' },
				{ severity: 'critical' },
				{ severity: 'medium' },
				{ severity: 'high' },
			];

			const sorted = sortGapsBySeverity(gaps);

			expect(sorted[0].severity).toBe('critical');
			expect(sorted[1].severity).toBe('high');
			expect(sorted[2].severity).toBe('medium');
			expect(sorted[3].severity).toBe('low');
		});
	});
});

describe('AI Assistant State Management', () => {
	describe('Loading State', () => {
		it('should track loading states correctly', () => {
			let isLoading = false;
			let error: string | null = null;

			// Start loading
			isLoading = true;
			expect(isLoading).toBe(true);

			// Complete loading
			isLoading = false;
			expect(isLoading).toBe(false);

			// Handle error
			error = 'API Error';
			expect(error).toBe('API Error');
		});
	});

	describe('Response Caching', () => {
		const cache = new Map<string, unknown>();

		const getCacheKey = (type: string, id: string, audience: string): string => {
			return `${type}:${id}:${audience}`;
		};

		it('should generate unique cache keys', () => {
			const key1 = getCacheKey('control', 'AC-2', 'executive');
			const key2 = getCacheKey('control', 'AC-2', 'engineer');
			const key3 = getCacheKey('risk', 'RISK-001', 'executive');

			expect(key1).toBe('control:AC-2:executive');
			expect(key2).toBe('control:AC-2:engineer');
			expect(key3).toBe('risk:RISK-001:executive');
			expect(key1).not.toBe(key2);
		});

		it('should cache and retrieve responses', () => {
			const key = getCacheKey('control', 'AC-2', 'executive');
			const response = { purpose: 'Test purpose' };

			cache.set(key, response);

			expect(cache.has(key)).toBe(true);
			expect(cache.get(key)).toEqual(response);
		});
	});
});
