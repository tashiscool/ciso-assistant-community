import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, depends }) => {
	depends('app:security-analytics');
	try {
		const incidentsResponse = await fetch(`${BASE_API_URL}/incidents/?limit=1000`);
		const incidentsData = incidentsResponse.ok ? await incidentsResponse.json() : { results: [], count: 0 };
		const incidents = incidentsData.results || [];

		const analytics = {
			totalIncidents: incidentsData.count || 0,
			activeIncidents: incidents.filter((i: any) => i.status === 'open' || i.status === 'in_progress').length,
			resolvedIncidents: incidents.filter((i: any) => i.status === 'resolved' || i.status === 'closed').length,
			criticalIncidents: incidents.filter((i: any) => i.severity === 'critical' || i.severity === 4).length,
			highIncidents: incidents.filter((i: any) => i.severity === 'high' || i.severity === 3).length,
			mediumIncidents: incidents.filter((i: any) => i.severity === 'medium' || i.severity === 2).length,
			lowIncidents: incidents.filter((i: any) => i.severity === 'low' || i.severity === 1).length,
			recentIncidents: incidents.slice(0, 10),
			resolutionRate: 0,
			slaComplianceRate: 0
		};

		analytics.resolutionRate = analytics.totalIncidents > 0 ?
			Math.round((analytics.resolvedIncidents / analytics.totalIncidents) * 100) : 0;

		// Simple SLA: resolved within 72 hours
		const slaCompliant = incidents.filter((i: any) => {
			if (i.status === 'resolved' || i.status === 'closed') {
				const created = new Date(i.created_at);
				const resolved = new Date(i.updated_at);
				return (resolved.getTime() - created.getTime()) <= 72 * 60 * 60 * 1000;
			}
			return false;
		}).length;
		analytics.slaComplianceRate = analytics.resolvedIncidents > 0 ?
			Math.round((slaCompliant / analytics.resolvedIncidents) * 100) : 100;

		return { title: 'Security Analytics Dashboard', analytics };
	} catch (err) {
		console.error('Error loading security analytics:', err);
		throw error(500, 'Failed to load security analytics');
	}
};
