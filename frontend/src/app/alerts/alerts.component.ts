import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../shared/services/api.service';
import { NotificationService } from '../shared/services/notification.service';
import { Alert, AlertType } from '../shared/models/interfaces';

@Component({
    selector: 'app-alerts',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './alerts.component.html',
    styleUrls: ['./alerts.component.scss']
})
export class AlertsComponent implements OnInit {

    alerts: Alert[] = [];
    unread = 0;
    loading = false;

    filterType = '';
    filterRead = '';

    constructor(private api: ApiService, private notify: NotificationService) { }

    ngOnInit() { this.loadAlerts(); }

    loadAlerts() {
        this.loading = true;
        const filters: any = {};
        if (this.filterType) filters.type = this.filterType;
        if (this.filterRead) filters.is_read = this.filterRead;

        this.api.getAlerts(filters).subscribe({
            next: res => { this.alerts = res.data; this.unread = res.unread; this.loading = false; },
            error: () => { this.loading = false; this.alerts = this.demoAlerts(); this.unread = 3; }
        });
    }

    markRead(a: Alert) {
        this.api.markAlertRead(a.id).subscribe({
            next: () => { a.is_read = true; this.unread = Math.max(0, this.unread - 1); },
            error: () => { }
        });
    }

    markAllRead() {
        this.api.markAllAlertsRead().subscribe({
            next: () => { this.alerts.forEach(a => a.is_read = true); this.unread = 0; this.notify.success('All alerts marked as read'); },
            error: () => { }
        });
    }

    dismiss(a: Alert) {
        this.api.dismissAlert(a.id).subscribe({
            next: () => { this.alerts = this.alerts.filter(x => x.id !== a.id); if (!a.is_read) this.unread = Math.max(0, this.unread - 1); },
            error: () => { this.alerts = this.alerts.filter(x => x.id !== a.id); }
        });
    }

    getIcon(type: AlertType): string {
        const icons: Record<AlertType, string> = {
            LOW_STOCK: '📦', OUT_OF_STOCK: '🚨', EXPIRY: '📅', RESTOCK_SUGGESTED: '🤖'
        };
        return icons[type] || '🔔';
    }

    getTypeClass(type: AlertType): string {
        return { LOW_STOCK: 'low', OUT_OF_STOCK: 'out', EXPIRY: 'amber', RESTOCK_SUGGESTED: 'info' }[type] || '';
    }

    private demoAlerts(): Alert[] {
        const now = new Date().toISOString();
        return [
            { id: 1, product_id: 3, Product: { id: 3, name: 'USB-C Hub 7-in-1', sku: 'SKU-042', category: 'Electronics', vendor_id: 3, reorder_level: 20, current_stock: 2, unit_price: 49.99 } as any, type: 'OUT_OF_STOCK', message: 'USB-C Hub 7-in-1 (SKU-042): only 2 units remaining (reorder: 20)', is_read: false, created_at: now },
            { id: 2, product_id: 5, Product: { id: 5, name: 'Monitor 27" 4K', sku: 'SKU-103', category: 'Electronics', vendor_id: 3, reorder_level: 5, current_stock: 0, unit_price: 599 } as any, type: 'OUT_OF_STOCK', message: 'Monitor 27" 4K (SKU-103): OUT OF STOCK!', is_read: false, created_at: now },
            { id: 3, product_id: 1, Product: { id: 1, name: 'Laptop Stand Pro', sku: 'SKU-001', category: 'Electronics', vendor_id: 3, reorder_level: 15, current_stock: 5, unit_price: 29.99 } as any, type: 'RESTOCK_SUGGESTED', message: 'AI suggests restocking Laptop Stand Pro — forecasted demand: 42 units this week', is_read: false, created_at: now },
            { id: 4, product_id: 4, type: 'LOW_STOCK', Product: { id: 4, name: 'Wireless Keyboard', sku: 'SKU-087', category: 'Electronics', vendor_id: 3, reorder_level: 25, current_stock: 8, unit_price: 79.99 } as any, message: 'Wireless Keyboard (SKU-087): below reorder level (8 of 25)', is_read: true, created_at: now },
            { id: 5, product_id: 7, type: 'EXPIRY', Product: { id: 7, name: 'Mechanical Mouse', sku: 'SKU-156', category: 'Electronics', vendor_id: 3, reorder_level: 30, current_stock: 11, unit_price: 59.99 } as any, message: 'Batch #D-2024 expires in 3 days — 28 units affected', is_read: true, created_at: now },
        ];
    }
}