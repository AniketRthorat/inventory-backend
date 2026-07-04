// inventory-backend/src/utils/db.js

export const getDb = (db) => {
    return {
        // Labs CRUD
        async getAllLabs() {
            const { results } = await db.prepare('SELECT * FROM labs').all();
            return results;
        },
        async getLabById(id) {
            const { results } = await db.prepare('SELECT * FROM labs WHERE lab_id = ?').bind(id).all();
            return results[0];
        },
        async createLab(lab_name, location, capacity, assistant_name = null, assistant_phone = null) {
            const formatString = (str) => {
                if (!str || str === 'N/A') return str;
                return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            };
            const capitalizedName = formatString(lab_name);
            const capitalizedAssistantName = formatString(assistant_name);
            const trimmedPhone = assistant_phone ? assistant_phone.trim() : null;
            const { success } = await db.prepare(
                'INSERT INTO labs (lab_name, location, capacity, assistant_name, assistant_phone) VALUES (?, ?, ?, ?, ?)'
            )
                .bind(capitalizedName, location, capacity, capitalizedAssistantName, trimmedPhone)
                .run();
            return success;
        },
        async updateLab(id, lab_name, location, capacity, assistant_name = null, assistant_phone = null) {
            const formatString = (str) => {
                if (!str || str === 'N/A') return str;
                return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            };
            const capitalizedName = formatString(lab_name);
            const capitalizedAssistantName = formatString(assistant_name);
            const trimmedPhone = assistant_phone ? assistant_phone.trim() : null;
            const { success } = await db.prepare(
                'UPDATE labs SET lab_name = ?, location = ?, capacity = ?, assistant_name = ?, assistant_phone = ?, updated_at = CURRENT_TIMESTAMP WHERE lab_id = ?'
            )
                .bind(capitalizedName, location, capacity, capitalizedAssistantName, trimmedPhone, id)
                .run();
            return success;
        },
        async deleteLab(id) {
            const { success } = await db.prepare('DELETE FROM labs WHERE lab_id = ?').bind(id).run();
            return success;
        },
        async updateLabAssistant(id, assistant_name) {
            const { success } = await db.prepare(
                'UPDATE labs SET assistant_name = ? WHERE lab_id = ?'
            ).bind(assistant_name, id).run();
            return success;
        },

        // Faculty CRUD
        async getAllFaculty() {
            const { results } = await db.prepare('SELECT * FROM faculty').all();
            return results;
        },
        async getFacultyById(id) {
            const { results } = await db.prepare('SELECT * FROM faculty WHERE faculty_id = ?').bind(id).all();
            return results[0];
        },
        async createFaculty(faculty_name, email, department, location) {
            const formatString = (str) => {
                if (!str || str === 'N/A') return str;
                return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            };
            const capitalizedName = formatString(faculty_name);
            const capitalizedDept = formatString(department);
            const normalizedEmail = email.trim().toLowerCase();
            const { success } = await db.prepare(
                'INSERT INTO faculty (faculty_name, email, department, location) VALUES (?, ?, ?, ?)'
            )
                .bind(capitalizedName, normalizedEmail, capitalizedDept, location)
                .run();
            return success;
        },
        async updateFaculty(id, faculty_name, email, department, location) {
            const formatString = (str) => {
                if (!str || str === 'N/A') return str;
                return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            };
            const capitalizedName = formatString(faculty_name);
            const capitalizedDept = formatString(department);
            const { success } = await db.prepare(
                'UPDATE faculty SET faculty_name = ?, email = ?, department = ?, location = ?, updated_at = CURRENT_TIMESTAMP WHERE faculty_id = ?'
            )
                .bind(capitalizedName, email, capitalizedDept, location, id)
                .run();
            return success;
        },
        async deleteFaculty(id) {
            const { success } = await db.prepare('DELETE FROM faculty WHERE faculty_id = ?').bind(id).run();
            return success;
        },

        // Devices CRUD
        async getAllDevices({ lab_id = null, faculty_id = null, device_type = null, status = null } = {}) {
            let query = `
                SELECT 
                    d.device_id, 
                    d.lab_id, 
                    d.faculty_id, 
                    d.device_name, 
                    d.company, 
                    COALESCE(d.lab_location, l.lab_name) as lab_location,
                    d.device_type, 
                    d.status, 
                    d.ram, 
                    d.storage, 
                    d.cpu, 
                    d.ip_generation, 
                    d.last_maintenance_date, 
                    d.ink_levels, 
                    d.display_size, 
                    d.invoice_number, 
                    d.remark, 
                    d.updated_at
                FROM devices d
                LEFT JOIN labs l ON d.lab_id = l.lab_id
            `;
            const conditions = [];
            const bindings = [];

            if (lab_id !== null) {
                conditions.push('d.lab_id = ?');
                bindings.push(lab_id);
            }
            if (faculty_id !== null) {
                conditions.push('d.faculty_id = ?');
                bindings.push(faculty_id);
            }
            if (device_type !== null) {
                if (Array.isArray(device_type)) {
                    conditions.push(`TRIM(d.device_type) IN (${device_type.map(() => '?').join(', ')})`);
                    bindings.push(...device_type);
                } else {
                    conditions.push('TRIM(d.device_type) = ?');
                    bindings.push(device_type);
                }
            }
            if (status !== null) {
                conditions.push('d.status = ?');
                bindings.push(status);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            const { results } = await db.prepare(query).bind(...bindings).all();
            return results;
        },
        async getDeviceById(id) {
            const { results } = await db.prepare('SELECT * FROM devices WHERE device_id = ?').bind(id).all();
            return results[0];
        },
        async getDeviceByIdPublic(id) {
            const query = `
                SELECT 
                    d.device_name, 
                    d.device_type, 
                    d.company, 
                    d.status,
                    d.ram, 
                    d.storage, 
                    d.cpu,
                    d.display_size,
                    d.last_maintenance_date,
                    d.invoice_number,
                    d.ip_generation,
                    l.lab_name,
                    l.assistant_name,
                    f.faculty_name
                FROM devices d
                LEFT JOIN labs l ON d.lab_id = l.lab_id
                LEFT JOIN faculty f ON d.faculty_id = f.faculty_id
                WHERE d.device_id = ?
            `;
            const { results } = await db.prepare(query).bind(id).all();
            return results[0];
        },
        async createDevice(deviceData) {
            const formatString = (str) => {
                if (!str || str === 'N/A') return str;
                return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            };
            const {
                lab_id = null,
                faculty_id = null,
                device_name,
                company = null,
                lab_location = null,
                device_type,
                status,
                ram = null,
                storage = null,
                cpu = null,
                gpu = null,
                last_maintenance_date = null,
                ink_levels = null,
                display_size = null,
                invoice_number = null,
                invoice_pdf = null,
                remark = null,
                ip_generation = null
            } = deviceData;

            const capitalizedName = formatString(device_name);
            const capitalizedCompany = formatString(company);
            const capitalizedLabLoc = formatString(lab_location);

            const { success } = await db.prepare(
                'INSERT INTO devices (lab_id, faculty_id, device_name, company, lab_location, device_type, status, ram, storage, cpu, ip_generation, last_maintenance_date, ink_levels, display_size, invoice_number, invoice_pdf, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
                .bind(lab_id, faculty_id, capitalizedName, capitalizedCompany, capitalizedLabLoc, device_type, status, ram, storage, cpu, ip_generation, last_maintenance_date, ink_levels, display_size, invoice_number, invoice_pdf, remark)
                .run();
            return success;
        },
        async updateDevice(id, deviceData) {
            const formatString = (str) => {
                if (!str || str === 'N/A') return str;
                return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            };
            let {
                lab_id, faculty_id, device_name, company, lab_location, device_type, status, ram, storage, cpu, ip_generation, last_maintenance_date, ink_levels, display_size
            } = deviceData;

            if (faculty_id) {
                lab_id = null;
            } else if (lab_id) {
                faculty_id = null;
            }

            const capitalizedName = formatString(device_name);
            const capitalizedCompany = formatString(company);
            const capitalizedLabLoc = formatString(lab_location);

            const { success } = await db.prepare(
                'UPDATE devices SET lab_id = ?, faculty_id = ?, device_name = ?, company = ?, lab_location = ?, device_type = ?, status = ?, ram = ?, storage = ?, cpu = ?, ip_generation = ?, last_maintenance_date = ?, ink_levels = ?, display_size = ?, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?'
            )
                .bind(lab_id, faculty_id, capitalizedName, capitalizedCompany, capitalizedLabLoc, device_type, status, ram, storage, cpu, ip_generation, last_maintenance_date, ink_levels, display_size, id)
                .run();
            return success;
        },
        async deleteDevice(id) {
            const { success } = await db.prepare('DELETE FROM devices WHERE device_id = ?').bind(id).run();
            return success;
        },

        async getAllInvoices() {
            const { results } = await db.prepare(`
                SELECT 
                    i.invoice_number, 
                    i.updated_at,
                    COUNT(d.device_id) as device_count
                FROM invoices i
                LEFT JOIN devices d ON i.invoice_number = d.invoice_number
                GROUP BY i.invoice_number
            `).all();
            return results;
        },

        async getInvoiceByNumber(invoice_number) {
            const invoice = await db.prepare('SELECT invoice_number, updated_at, created_at FROM invoices WHERE invoice_number = ?').bind(invoice_number).first();
            if (!invoice) return null;

            const devices = await db.prepare(`
                SELECT device_id, device_name, device_type, status
                FROM devices
                WHERE invoice_number = ?
            `).bind(invoice_number).all();

            return {
                ...invoice,
                devices: devices.results
            };
        },

        async getInvoicePdf(invoice_number) {
            const result = await db.prepare('SELECT invoice_pdf FROM invoices WHERE invoice_number = ?').bind(invoice_number).first();
            return result ? result.invoice_pdf : null;
        },

        async addInvoiceToDevices(invoice_number, invoice_pdf, device_ids) {
            const statements = [];

            // 1. Upsert the invoice in the invoices table
            if (invoice_pdf) {
                statements.push(
                    db.prepare(`
                        INSERT INTO invoices (invoice_number, invoice_pdf) 
                        VALUES (?, ?)
                        ON CONFLICT(invoice_number) DO UPDATE SET 
                            invoice_pdf = excluded.invoice_pdf,
                            updated_at = CURRENT_TIMESTAMP
                    `).bind(invoice_number, invoice_pdf)
                );
            } else {
                // Just ensure the invoice entry exists if only linking devices
                statements.push(
                    db.prepare(`
                        INSERT OR IGNORE INTO invoices (invoice_number) VALUES (?)
                    `).bind(invoice_number)
                );
            }

            // 2. Link devices to this invoice number
            if (device_ids && device_ids.length > 0) {
                device_ids.forEach(device_id => {
                    statements.push(
                        db.prepare(
                            'UPDATE devices SET invoice_number = ?, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?'
                        ).bind(invoice_number, device_id)
                    );
                });
            }

            if (statements.length === 0) {
                return { success: true, count: 0 };
            }

            const results_batch = await db.batch(statements);
            return {
                success: results_batch.every(r => r.success),
                count: device_ids ? device_ids.length : 0
            };
        },

        async deleteInvoice(invoice_number) {
            const statements = [
                // 1. Unmap invoice from devices
                db.prepare('UPDATE devices SET invoice_number = NULL WHERE invoice_number = ?').bind(invoice_number),
                // 2. Delete the invoice itself
                db.prepare('DELETE FROM invoices WHERE invoice_number = ?').bind(invoice_number)
            ];
            const results = await db.batch(statements);
            return results.every(r => r.success);
        },

        async updateInvoice(old_invoice_number, new_invoice_number, invoice_pdf = null) {
            const statements = [];

            // 1. If invoice number changed, update devices first
            if (old_invoice_number !== new_invoice_number) {
                statements.push(
                    db.prepare('UPDATE devices SET invoice_number = ? WHERE invoice_number = ?')
                        .bind(new_invoice_number, old_invoice_number)
                );
            }

            // 2. Update invoice entry
            if (invoice_pdf) {
                statements.push(
                    db.prepare(`
                        INSERT INTO invoices (invoice_number, invoice_pdf) 
                        VALUES (?, ?)
                        ON CONFLICT(invoice_number) DO UPDATE SET 
                            invoice_pdf = excluded.invoice_pdf,
                            updated_at = CURRENT_TIMESTAMP
                    `).bind(new_invoice_number, invoice_pdf)
                );
            } else if (old_invoice_number !== new_invoice_number) {
                // Update the number in the invoices table if it changed but no new PDF
                statements.push(
                    db.prepare('UPDATE invoices SET invoice_number = ?, updated_at = CURRENT_TIMESTAMP WHERE invoice_number = ?')
                        .bind(new_invoice_number, old_invoice_number)
                );
            }

            if (statements.length === 0) return true;

            const results = await db.batch(statements);
            return results.every(r => r.success);
        },

        // Device Management
        async reassignDevice(device_id, new_faculty_id) {
            const { success } = await db.prepare(
                'UPDATE devices SET faculty_id = ?, lab_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?'
            )
                .bind(new_faculty_id, device_id)
                .run();
            return success;
        },
        async reassignDeviceToLab(device_id, new_lab_id) {
            const { success } = await db.prepare(
                'UPDATE devices SET lab_id = ?, faculty_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?'
            )
                .bind(new_lab_id, device_id)
                .run();
            return success;
        },
        async deselectDevice(device_id) {
            const { success } = await db.prepare(
                'UPDATE devices SET faculty_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?'
            )
                .bind(device_id)
                .run();
            return success;
        },
        async markDeviceAsDeadStock(device_id, remark) {
            const { success } = await db.prepare(
                'UPDATE devices SET status = "defective_stock", remark = ?, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?'
            )
                .bind(remark, device_id)
                .run();
            return success;
        },

        async markPartsAsDeadStock(originalDeviceId, parts, remark) {
            const { results } = await db.prepare('SELECT * FROM devices WHERE device_id = ?').bind(originalDeviceId).all();
            const originalDevice = results[0];

            if (!originalDevice) {
                throw new Error('Original device not found');
            }

            const statements = [];

            for (const part of parts) {
                const newDeviceName = `${part.charAt(0).toUpperCase() + part.slice(1)} from ${originalDevice.device_name}`;

                // Create a new device for the defective stock part
                statements.push(
                    db.prepare(
                        'INSERT INTO devices (device_name, device_type, status, remark, company, invoice_number) VALUES (?, ?, ?, ?, ?, ?)'
                    )
                        .bind(
                            newDeviceName,
                            part, // 'mouse', 'keyboard', etc.
                            'defective_stock',
                            remark,
                            originalDevice.company,
                            originalDevice.invoice_number
                        )
                );
            }

            // Update the original device's remark
            const newRemark = `Parts moved to defective stock: ${parts.join(', ')}. ${remark}`;
            const updatedRemark = originalDevice.remark ? `${originalDevice.remark}\n${newRemark}` : newRemark;

            statements.push(
                db.prepare('UPDATE devices SET remark = ? WHERE device_id = ?')
                    .bind(updatedRemark, originalDeviceId)
            );

            const results_batch = await db.batch(statements);

            // Check if all statements in the batch were successful
            return results_batch.every(result => result.success);
        },

        // User Authentication
        async createUser(email, hashedPassword) {
            const { success, meta } = await db.prepare(
                'INSERT INTO users (email, password) VALUES (?, ?)'
            )
                .bind(email, hashedPassword)
                .run();
            if (success) {
                return { success: true, user_id: meta.last_row_id };
            }
            return { success: false };
        },
        async findUserByEmail(email) {
            const { results } = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).all();
            return results[0];
        },
        async findUserById(user_id) {
            const { results } = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(user_id).all();
            return results[0];
        },
        async findUserByGoogleId(google_id) {
            const { results } = await db.prepare('SELECT * FROM users WHERE google_id = ?').bind(google_id).all();
            return results[0];
        },
        async updateGoogleId(user_id, google_id) {
            const { success } = await db.prepare(
                'UPDATE users SET google_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
            )
                .bind(google_id, user_id)
                .run();
            return success;
        },

        async getSystemStatusReportData() {
            const allDevices = await this.getAllDevices();

            const totalDevices = allDevices.length;
            const activeDevices = allDevices.filter(d => d.status === 'active').length;
            const defectiveStockDevices = allDevices.filter(d => d.status === 'defective_stock').length;

            const devicesByType = {};
            allDevices.forEach(device => {
                devicesByType[device.device_type] = (devicesByType[device.device_type] || 0) + 1;
            });

            const statusSummary = {
                'Total Devices': totalDevices,
                'Active Devices': activeDevices,
                'Defective Stock Devices': defectiveStockDevices,
            };

            const typeStatusData = [];
            for (const type in devicesByType) {
                const count = devicesByType[type];
                const active = allDevices.filter(d => d.device_type === type && d.status === 'active').length;
                const defective_stock = allDevices.filter(d => d.device_type === type && d.status === 'defective_stock').length;
                typeStatusData.push({
                    device_type: type,
                    total: count,
                    active: active,
                    defective_stock: defective_stock,
                });
            }

            return { statusSummary, typeStatusData };
        },

        async getDeadStockReportData() {
            const defectiveStockDevices = await this.getAllDevices({ status: 'defective_stock' }); // Assuming getAllDevices can filter by status
            return { defectiveStockDevices };
        },

        async getFacultyInventoryReportData() {
            const faculty = await this.getAllFaculty();
            const activeDevices = await this.getAllDevices({ status: 'active' }); // Fetch only active devices

            // Group devices by faculty
            const facultyWithDevices = faculty.map(fac => {
                const devicesAssignedToFaculty = activeDevices.filter(device => device.faculty_id === fac.faculty_id);
                return {
                    ...fac,
                    devices: devicesAssignedToFaculty,
                };
            });

            return { faculty: facultyWithDevices };
        },

        async getLabWiseReportData() {
            const labs = await this.getAllLabs();
            const allDevices = await this.getAllDevices();

            // Group devices by lab
            const labsWithDevices = labs.map(lab => {
                const devicesInLab = allDevices.filter(device => device.lab_id === lab.lab_id);
                return {
                    ...lab,
                    devices: devicesInLab,
                };
            });

            return { labs: labsWithDevices };
        },

        // Reports Data
        async getCompleteInventoryReportData() {
            const devices = await this.getAllDevices(); // Use existing getAllDevices
            const labs = await this.getAllLabs();     // Use existing getAllLabs
            const faculty = await this.getAllFaculty(); // Use existing getAllFaculty

            return { devices, labs, faculty };
        },

        async getOrCreateHodCabinLabId() {
            const HOD_CABIN_NAME = 'Central Store';
            const OLD_NAME = 'HOD Cabin';

            try {
                // First, check if Central Store exists
                let { results } = await db.prepare('SELECT lab_id FROM labs WHERE lab_name = ?').bind(HOD_CABIN_NAME).all();
                if (results && results.length > 0) {
                    return results[0].lab_id;
                }

                // If not, check if HOD Cabin exists and rename it
                let { results: oldResults } = await db.prepare('SELECT lab_id FROM labs WHERE lab_name = ?').bind(OLD_NAME).all();
                if (oldResults && oldResults.length > 0) {
                    const oldId = oldResults[0].lab_id;
                    await db.prepare('UPDATE labs SET lab_name = ? WHERE lab_id = ?').bind(HOD_CABIN_NAME, oldId).run();
                    console.log(`Renamed lab ${OLD_NAME} to ${HOD_CABIN_NAME} (ID: ${oldId})`);
                    return oldId;
                }

                // If neither exists, create Central Store
                const { success, meta } = await db.prepare(
                    'INSERT INTO labs (lab_name, location, capacity) VALUES (?, ?, ?)'
                )
                    .bind(HOD_CABIN_NAME, 'Central Store', 0)
                    .run();
                if (success) {
                    console.log(`Created new lab: ${HOD_CABIN_NAME}`);
                    return meta.last_row_id;
                } else {
                    throw new Error('Failed to create Central Store lab');
                }
            } catch (error) {
                console.error('Error in getOrCreateHodCabinLabId:', error);
                throw error;
            }
        },

        // Dashboard Statistics
        async getDashboardStats() {
            try {
                const [
                    totalFaculty,
                    totalDevices,
                    totalComputers,
                    totalLaptops,
                    totalPrinters,
                    totalDigitalBoards,
                    totalPointers,
                    totalProjectors,
                    totalCPUs,
                    totalMice,
                    totalKeyboards,
                    totalComputersActive,
                    totalComputersDeadStock,
                    devicesByLab,
                ] = await Promise.all([
                    db.prepare('SELECT COUNT(*) as count FROM faculty').first(),
                    db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'active'").first(),
                    db.prepare("SELECT COUNT(*) as count FROM devices WHERE TRIM(device_type) IN ('desktop', 'server', 'monitor') AND status = 'active'").first(),
                    db.prepare("SELECT COUNT(*) as count FROM devices WHERE TRIM(device_type) = 'laptop' AND status = 'active'").first(),
                    db.prepare('SELECT COUNT(*) as count FROM devices WHERE TRIM(device_type) = "printer" AND status = \'active\'').first(),
                    db.prepare("SELECT COUNT(*) as count FROM devices WHERE TRIM(device_type) = 'digital_board' AND status = 'active'").first(),
                    db.prepare("SELECT COUNT(*) as count FROM devices WHERE TRIM(device_type) = 'pointer' AND status = 'active'").first(),
                    db.prepare("SELECT COUNT(*) as count FROM devices WHERE TRIM(device_type) = 'projector' AND status = 'active'").first(),
                    db.prepare("SELECT COUNT(*) as count FROM devices WHERE TRIM(device_type) = 'cpu' AND status = 'active'").first(),
                    db.prepare("SELECT COUNT(*) as count FROM devices WHERE TRIM(device_type) = 'mouse' AND status = 'active'").first(),
                    db.prepare("SELECT COUNT(*) as count FROM devices WHERE TRIM(device_type) = 'keyboard' AND status = 'active'").first(),
                    db.prepare("SELECT COUNT(*) as count FROM devices WHERE device_type IN ('laptop', 'desktop', 'server', 'monitor') AND status = 'active'").first(),
                    db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'defective_stock'").first(),
                    db.prepare(`
                        SELECT
                            l.lab_id,
                            l.lab_name as lab,
                            l.assistant_name,
                            COUNT(d.device_id) as count
                        FROM labs l
                        LEFT JOIN devices d ON l.lab_id = d.lab_id AND d.status = 'active'
                        GROUP BY l.lab_id, l.lab_name, l.assistant_name
                        ORDER BY l.lab_name
                    `).all(),
                ]);

                return {
                    totalFaculty: totalFaculty.count,
                    totalDevices: totalDevices.count,
                    totalComputers: totalComputers.count,
                    totalLaptops: totalLaptops.count,
                    totalPrinters: totalPrinters.count,
                    totalDigitalBoards: totalDigitalBoards.count,
                    totalPointers: totalPointers.count,
                    totalProjectors: totalProjectors.count,
                    totalCPUs: totalCPUs.count,
                    totalMice: totalMice.count,
                    totalKeyboards: totalKeyboards.count,
                    computersByStatus: {
                        active: totalComputersActive.count,
                        defective_stock: totalComputersDeadStock.count,
                    },
                    devicesByLab: devicesByLab.results,
                };
            } catch (error) {
                throw error;
            }
        },

        // Maintenance Logs
        async addMaintenanceLog(device_id, assistant_name, changes_made, resolved_issue_ids = []) {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const statements = [
                // Insert the maintenance log
                db.prepare(
                    'INSERT INTO maintenance_logs (device_id, assistant_name, changes_made, maintenance_date) VALUES (?, ?, ?, ?)'
                ).bind(device_id, assistant_name, changes_made, today),
                // Update last_maintenance_date on the device
                db.prepare(
                    'UPDATE devices SET last_maintenance_date = ?, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?'
                ).bind(today, device_id),
            ];

            if (resolved_issue_ids && resolved_issue_ids.length > 0) {
                resolved_issue_ids.forEach(issue_id => {
                    statements.push(
                        db.prepare(
                            "UPDATE issues SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, action_taken = ? WHERE issue_id = ?"
                        ).bind(changes_made, issue_id)
                    );
                });
            }

            const results = await db.batch(statements);
            return results.every(r => r.success);
        },

        async getMaintenanceLogs(device_id) {
            const { results } = await db.prepare(
                'SELECT log_id, assistant_name, changes_made, maintenance_date FROM maintenance_logs WHERE device_id = ? ORDER BY maintenance_date DESC, log_id DESC'
            ).bind(device_id).all();
            return results;
        },

        async deleteMaintenanceLog(log_id) {
            const result = await db.prepare(
                'DELETE FROM maintenance_logs WHERE log_id = ?'
            ).bind(log_id).run();
            return result.success;
        },

        // Issues
        async reportIssue(device_id, lab_id, student_class, student_div, student_roll_no, description) {
            const { success } = await db.prepare(
                'INSERT INTO issues (device_id, lab_id, student_class, student_div, student_roll_no, description) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(device_id, lab_id, student_class, student_div, student_roll_no, description).run();
            return success;
        },

        async getLabAssistantIssues() {
            // Pending issues <= 48 hours old
            const { results } = await db.prepare(`
                SELECT i.*, l.lab_name, l.assistant_name, d.device_name 
                FROM issues i 
                LEFT JOIN labs l ON i.lab_id = l.lab_id 
                LEFT JOIN devices d ON i.device_id = d.device_id 
                WHERE i.status = 'pending' AND (julianday(CURRENT_TIMESTAMP) - julianday(i.reported_at)) * 24 <= 48 
                ORDER BY i.reported_at ASC
            `).all();
            return results;
        },

        async getEscalatedIssues() {
            // Pending issues > 48 hours old
            const { results } = await db.prepare(`
                SELECT i.*, l.lab_name, l.assistant_name, d.device_name 
                FROM issues i 
                LEFT JOIN labs l ON i.lab_id = l.lab_id 
                LEFT JOIN devices d ON i.device_id = d.device_id 
                WHERE i.status = 'pending' AND (julianday(CURRENT_TIMESTAMP) - julianday(i.reported_at)) * 24 > 48 
                ORDER BY i.reported_at ASC
            `).all();
            return results;
        },

        async getPendingIssues() {
            // All pending issues
            const { results } = await db.prepare(`
                SELECT i.*, l.lab_name, l.assistant_name, d.device_name 
                FROM issues i 
                LEFT JOIN labs l ON i.lab_id = l.lab_id 
                LEFT JOIN devices d ON i.device_id = d.device_id 
                WHERE i.status = 'pending' 
                ORDER BY i.reported_at ASC
            `).all();
            return results;
        },

        async getResolvedIssues() {
            // All resolved issues
            const { results } = await db.prepare(`
                SELECT i.*, l.lab_name, l.assistant_name, d.device_name 
                FROM issues i 
                LEFT JOIN labs l ON i.lab_id = l.lab_id 
                LEFT JOIN devices d ON i.device_id = d.device_id 
                WHERE i.status = 'resolved' 
                ORDER BY i.resolved_at DESC
            `).all();
            return results;
        },

        async resolveIssue(issue_id, action_taken) {
            const { success } = await db.prepare(
                "UPDATE issues SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, action_taken = ? WHERE issue_id = ?"
            ).bind(action_taken || '', issue_id).run();
            return success;
        },

        async deleteIssue(issue_id) {
            const { success } = await db.prepare(
                "DELETE FROM issues WHERE issue_id = ?"
            ).bind(issue_id).run();
            return success;
        },

        async getPendingIssuesByDeviceId(device_id) {
            const { results } = await db.prepare(
                "SELECT issue_id, description, reported_at, student_class, student_div, student_roll_no FROM issues WHERE device_id = ? AND status = 'pending' ORDER BY reported_at DESC"
            ).bind(device_id).all();
            return results;
        },

        async capitalizeExistingNames() {
            const formatString = (str) => {
                if (!str || str === 'N/A') return str;
                return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            };

            const devices = await this.getAllDevices();
            const labs = await this.getAllLabs();
            const faculty = await this.getAllFaculty();

            const statements = [];

            devices.forEach(d => {
                const capitalized = formatString(d.device_name);
                if (capitalized !== d.device_name) {
                    statements.push(
                        db.prepare('UPDATE devices SET device_name = ? WHERE device_id = ?')
                            .bind(capitalized, d.device_id)
                    );
                }
            });

            labs.forEach(l => {
                const capitalized = formatString(l.lab_name);
                if (capitalized !== l.lab_name) {
                    statements.push(
                        db.prepare('UPDATE labs SET lab_name = ? WHERE lab_id = ?')
                            .bind(capitalized, l.lab_id)
                    );
                }
            });

            faculty.forEach(f => {
                const capitalizedName = formatString(f.faculty_name);
                const capitalizedDept = formatString(f.department);
                if (capitalizedName !== f.faculty_name || capitalizedDept !== f.department) {
                    statements.push(
                        db.prepare('UPDATE faculty SET faculty_name = ?, department = ? WHERE faculty_id = ?')
                            .bind(capitalizedName, capitalizedDept, f.faculty_id)
                    );
                }
            });

            if (statements.length === 0) return { success: true, count: 0 };

            const results_batch = await db.batch(statements);
            return {
                success: results_batch.every(r => r.success),
                count: statements.length
            };
        },
    };
};
