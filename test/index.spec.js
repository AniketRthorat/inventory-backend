import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import worker from '../src';

describe('Hello World worker', () => {
	it('responds with Hello World from Inventory Backend! (unit style)', async () => {
		const request = new Request('http://example.com/');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World from Inventory Backend!"`);
	});

	it('responds with Hello World from Inventory Backend! (integration style)', async () => {
		const response = await SELF.fetch('http://example.com/');
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World from Inventory Backend!"`);
	});
});

describe('Issue Reporting and WhatsApp Notification Flow', () => {
	it('saves reported issue and fires WhatsApp notification', async () => {
		// Mock global fetch to capture Meta API call
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		fetchSpy.mockImplementation((url, init) => {
			if (url.includes('graph.facebook.com')) {
				return Promise.resolve(new Response(JSON.stringify({ 
					messaging_product: 'whatsapp', 
					contacts: [{ input: '919876543210', wa_id: '919876543210' }], 
					messages: [{ id: 'wamid.HBgLOTE5ODc2NTQzMjEwFQIAERgEOTQ5RDU0QjI4QTMyMzE3QjY0AA==' }] 
				}), { status: 200 }));
			}
			return Promise.resolve(new Response(null, { status: 404 }));
		});

		// 1. Initialize Database Schema
		env.WHATSAPP_TEMPLATE_NAME = 'lab_issue_report';
		const initRequest = new Request('http://example.com/api/init-db');
		const initCtx = createExecutionContext();
		const initResponse = await worker.fetch(initRequest, env, initCtx);
		await waitOnExecutionContext(initCtx);
		expect(initResponse.status).toBe(200);

		// 2. Insert mock lab and mock device directly into the test database
		await env.DB.prepare(
			"INSERT INTO labs (lab_id, lab_name, location, capacity, assistant_name, assistant_phone) VALUES (?, ?, ?, ?, ?, ?)"
		).bind(1, 'Lab 1', 'Ground Floor', 40, 'Rahul Assistant', '+91 98765 43210').run();

		await env.DB.prepare(
			"INSERT INTO devices (device_id, device_name, device_type, lab_id, status) VALUES (?, ?, ?, ?, ?)"
		).bind(1, 'System 1', 'desktop', 1, 'active').run();

		// 3. Post student issue to the endpoint
		// SGI-2Bj corresponds to device ID 1
		const issueRequest = new Request('http://example.com/api/public/devices/SGI-2Bj/issues', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				lab_id: 1,
				student_class: 'TY',
				student_div: 'A',
				student_roll_no: '45',
				description: 'Mouse scroll wheel is broken'
			})
		});
		
		const issueCtx = createExecutionContext();
		const issueResponse = await worker.fetch(issueRequest, env, issueCtx);
		await waitOnExecutionContext(issueCtx);
		
		// 4. Verify API response
		expect(issueResponse.status).toBe(201);
		const responseData = await issueResponse.json();
		expect(responseData.message).toBe('Issue reported successfully');

		// 5. Verify database record
		const dbIssue = await env.DB.prepare("SELECT * FROM issues WHERE device_id = 1").first();
		expect(dbIssue).toBeDefined();
		expect(dbIssue.description).toBe('Mouse scroll wheel is broken');
		expect(dbIssue.student_class).toBe('TY');
		expect(dbIssue.student_div).toBe('A');
		expect(dbIssue.student_roll_no).toBe('45');

		// 6. Verify Meta WhatsApp API fetch call parameters
		expect(fetchSpy).toHaveBeenCalled();
		const lastCall = fetchSpy.mock.calls.find(call => call[0].includes('graph.facebook.com'));
		expect(lastCall).toBeDefined();
		const [calledUrl, calledInit] = lastCall;

		// Verify phone number ID in URL
		expect(calledUrl).toContain('/1177104812156293/messages');

		// Verify headers
		expect(calledInit.headers.Authorization).toBe(`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`);
		expect(calledInit.headers['Content-Type']).toBe('application/json');

		// Verify body matches Meta's template parameter array structure
		const body = JSON.parse(calledInit.body);
		expect(body.to).toBe('919876543210'); // Sanitized from '+91 98765 43210'
		expect(body.type).toBe('template');
		expect(body.template.name).toBe('lab_issue_report');
		expect(body.template.language.code).toBe('en_US');

		const params = body.template.components[0].parameters;
		expect(params[0].text).toBe('Rahul Assistant');
		expect(params[1].text).toBe('Lab 1');
		expect(params[2].text).toBe('System 1');
		expect(params[3].text).toBe('SGI-2Bj');
		expect(params[4].text).toBe('TY');
		expect(params[5].text).toBe('A');
		expect(params[6].text).toBe('45');
		expect(params[7].text).toBe('Mouse scroll wheel is broken');

		// 7. Resolve the issue via public maintenance log submission
		const maintRequest = new Request('http://example.com/api/public/devices/SGI-2Bj/maintenance', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				assistant_name: 'Rahul Assistant',
				changes_made: 'Replaced mouse scroll wheel with new parts',
				resolved_issue_ids: [dbIssue.issue_id]
			})
		});

		const maintCtx = createExecutionContext();
		const maintResponse = await worker.fetch(maintRequest, env, maintCtx);
		await waitOnExecutionContext(maintCtx);

		expect(maintResponse.status).toBe(201);

		// 8. Verify the issue in the database is resolved
		const dbIssueResolved = await env.DB.prepare("SELECT * FROM issues WHERE issue_id = ?").bind(dbIssue.issue_id).first();
		expect(dbIssueResolved.status).toBe('resolved');
		expect(dbIssueResolved.action_taken).toBe('Replaced mouse scroll wheel with new parts');
		expect(dbIssueResolved.resolved_at).toBeDefined();

		// 9. Verify maintenance log is inserted
		const dbLogs = await env.DB.prepare("SELECT * FROM maintenance_logs WHERE device_id = 1").all();
		expect(dbLogs.results.length).toBe(1);
		expect(dbLogs.results[0].changes_made).toBe('Replaced mouse scroll wheel with new parts');

		// 10. Verify GET device details returns the updated last_maintenance_date and empty/no pending issues
		const getDeviceRequest = new Request('http://example.com/api/public/devices/SGI-2Bj');
		const getDeviceCtx = createExecutionContext();
		const getDeviceResponse = await worker.fetch(getDeviceRequest, env, getDeviceCtx);
		await waitOnExecutionContext(getDeviceCtx);

		expect(getDeviceResponse.status).toBe(200);
		const getDeviceData = await getDeviceResponse.json();
		expect(getDeviceData.last_maintenance_date).toBeDefined();
		expect(getDeviceData.pending_issues.length).toBe(0);

		// Restore spies
		fetchSpy.mockRestore();
	});
});
