import { BASE_API_URL } from '$lib/utils/constants';
import type { RiskMatrix, RiskMatrixJsonDefinition } from '$lib/utils/types';
import type { PageServerLoad } from './$types';
import { m } from '$paraglide/messages';

const FALLBACK_RISK_MATRIX: RiskMatrixJsonDefinition = {
	name: 'Default 5x5 Matrix',
	description: 'Cloudflare fallback matrix for scorer availability',
	probability: [
		{ abbreviation: 'VL', name: 'Very Low', description: 'Very unlikely' },
		{ abbreviation: 'L', name: 'Low', description: 'Unlikely' },
		{ abbreviation: 'M', name: 'Moderate', description: 'Possible' },
		{ abbreviation: 'H', name: 'High', description: 'Likely' },
		{ abbreviation: 'VH', name: 'Very High', description: 'Very likely' }
	],
	impact: [
		{ abbreviation: 'VL', name: 'Very Low', description: 'Minimal impact' },
		{ abbreviation: 'L', name: 'Low', description: 'Minor impact' },
		{ abbreviation: 'M', name: 'Moderate', description: 'Moderate impact' },
		{ abbreviation: 'H', name: 'High', description: 'Major impact' },
		{ abbreviation: 'VH', name: 'Very High', description: 'Severe impact' }
	],
	risk: [
		{ abbreviation: 'VL', name: 'Very Low', description: 'Acceptable', hexcolor: '#D1FAE5' },
		{ abbreviation: 'L', name: 'Low', description: 'Monitor', hexcolor: '#BBF7D0' },
		{ abbreviation: 'M', name: 'Moderate', description: 'Mitigate', hexcolor: '#FDE68A' },
		{ abbreviation: 'H', name: 'High', description: 'Prioritize', hexcolor: '#FCA5A5' },
		{ abbreviation: 'VH', name: 'Very High', description: 'Immediate action', hexcolor: '#F87171' }
	],
	grid: [
		[1, 1, 2, 2, 3],
		[1, 2, 2, 3, 3],
		[2, 2, 3, 3, 4],
		[2, 3, 3, 4, 4],
		[3, 3, 4, 4, 5]
	]
};

export const load: PageServerLoad = async ({ fetch }) => {
	const req = await fetch(`${BASE_API_URL}/risk-matrices/`);
	const reqData = req.ok ? await req.json() : { results: [] };
	const rows: RiskMatrix[] = Array.isArray(reqData?.results)
		? reqData.results
		: Array.isArray(reqData)
			? reqData
			: [];

	const risk_matrices: RiskMatrixJsonDefinition[] = rows
		.map((riskMatrix: RiskMatrix) => {
			try {
				return {
					...JSON.parse(riskMatrix.json_definition),
					name: riskMatrix.name
				} as RiskMatrixJsonDefinition;
			} catch {
				return null;
			}
		})
		.filter((entry): entry is RiskMatrixJsonDefinition => entry !== null);

	const displayRiskMatrices =
		risk_matrices.length > 0 ? risk_matrices : [FALLBACK_RISK_MATRIX];

	return {
		risk_matrices: displayRiskMatrices,
		title: m.scoringAssistant()
	};
};
