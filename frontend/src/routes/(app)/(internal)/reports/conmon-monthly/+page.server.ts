import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const [assessmentsRes, riskRes] = await Promise.all([
			fetch('/api/compliance-assessments/'),
			fetch('/api/risk-scenarios/')
		]);

		const assessments = assessmentsRes.ok ? await assessmentsRes.json() : { results: [] };
		const risks = riskRes.ok ? await riskRes.json() : { results: [] };

		let poamItems: any[] = [];
		try {
			const poamRes = await fetch('/api/poam-items/');
			if (poamRes.ok) {
				const poamData = await poamRes.json();
				poamItems = poamData.results || poamData || [];
			}
		} catch {}

		return {
			assessments: assessments.results || [],
			risks: risks.results || [],
			poamItems
		};
	} catch (e) {
		return { assessments: [], risks: [], poamItems: [] };
	}
};
