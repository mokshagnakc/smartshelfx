import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../shared/services/api.service';
import { NotificationService } from '../shared/services/notification.service';
import { PurchaseOrder, ForecastResult, Product, User } from '../shared/models/interfaces';

@Component({
    selector: 'app-orders',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule],
    templateUrl: './orders.component.html',
    styleUrls: ['./orders.component.scss']
})
export class OrdersComponent implements OnInit {

    orders: PurchaseOrder[] = [];
    suggestions: ForecastResult[] = [];
    products: Product[] = [];
    loading = false;
    showCreate = false;

    filterStatus = '';
    page = 1;
    total = 0;

    form!: FormGroup;

    constructor(
        private api: ApiService,
        private notify: NotificationService,
        private fb: FormBuilder
    ) { }

    ngOnInit() {
        this.buildForm();
        this.loadOrders();
        this.loadSuggestions();
        this.loadProducts();
    }

    buildForm() {
        this.form = this.fb.group({
            product_id: ['', Validators.required],
            vendor_id: ['', Validators.required],
            quantity: ['', [Validators.required, Validators.min(1)]],
            notes: ['']
        });
    }

    loadOrders() {
        this.loading = true;
        const filters: any = { page: this.page, limit: 15 };
        if (this.filterStatus) filters.status = this.filterStatus;
        this.api.getOrders(filters).subscribe({
            next: res => { this.orders = res.data; this.total = res.total; this.loading = false; },
            error: () => { this.loading = false; this.orders = this.demoOrders(); }
        });
    }

    loadSuggestions() {
        this.api.getOrderSuggestions().subscribe({
            next: res => this.suggestions = res,
            error: () => this.suggestions = this.demoSuggestions()
        });
    }

    loadProducts() {
        this.api.getProducts({ limit: 200 }).subscribe({
            next: res => this.products = res.data,
            error: () => { }
        });
    }

    createOrder() {
        if (this.form.invalid) { this.form.markAllAsTouched(); return; }
        this.api.createOrder(this.form.value).subscribe({
            next: () => { this.notify.success('Purchase order created & vendor notified!'); this.showCreate = false; this.form.reset(); this.loadOrders(); },
            error: err => this.notify.error(err.error?.error || 'Failed to create order')
        });
    }

    generateFromSuggestion(s: ForecastResult) {
        if (!s.Product) return;
        this.form.patchValue({ product_id: s.product_id, vendor_id: s.Product.vendor_id, quantity: Math.ceil(s.predicted_qty * 1.2) });
        this.showCreate = true;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateStatus(id: number, status: string) {
        this.api.updateOrderStatus(id, status).subscribe({
            next: () => { this.notify.success(`Order marked as ${status}`); this.loadOrders(); },
            error: err => this.notify.error(err.error?.error || 'Update failed')
        });
    }

    statusClass(s: string) { return { PENDING: 'pend', APPROVED: 'appr', DISPATCHED: 'disp', DELIVERED: 'ok', CANCELLED: 'out' }[s] || ''; }

    private demoOrders(): PurchaseOrder[] {
        return [
            { id: 2024, product_id: 1, Product: { id: 1, name: 'Laptop Stand Pro', sku: 'SKU-001', category: 'Electronics', vendor_id: 3, reorder_level: 15, current_stock: 5, unit_price: 29.99 } as Product, vendor_id: 3, vendor: { id: 3, name: 'TechSupplies', username: 'tech', email: 'vendor@techsupplies.com', role: 'VENDOR' } as User, quantity: 50, status: 'PENDING', created_at: '2026-02-20' },
            { id: 2023, product_id: 3, Product: { id: 3, name: 'USB-C Hub 7-in-1', sku: 'SKU-042', category: 'Electronics', vendor_id: 3, reorder_level: 20, current_stock: 2, unit_price: 49.99 } as Product, vendor_id: 3, vendor: { id: 3, name: 'TechSupplies', username: 'tech', email: 'vendor@techsupplies.com', role: 'VENDOR' } as User, quantity: 120, status: 'APPROVED', created_at: '2026-02-18' },
            { id: 2022, product_id: 6, Product: { id: 6, name: 'A4 Paper 500pk', sku: 'SKU-120', category: 'Supplies', vendor_id: 3, reorder_level: 50, current_stock: 200, unit_price: 12.99 } as Product, vendor_id: 3, vendor: { id: 3, name: 'OfficeGear Co.', username: 'og', email: 'og@vendor.com', role: 'VENDOR' } as User, quantity: 300, status: 'DISPATCHED', created_at: '2026-02-15' },
        ];
    }

    private demoSuggestions(): ForecastResult[] {
        return [
            { id: 1, product_id: 1, Product: { id: 1, name: 'Laptop Stand Pro', sku: 'SKU-001', category: 'Electronics', vendor_id: 3, reorder_level: 15, current_stock: 5, unit_price: 29.99 }, forecast_date: '', predicted_qty: 50, confidence: 0.92, risk_level: 'HIGH', created_at: '' },
            { id: 2, product_id: 3, Product: { id: 3, name: 'USB-C Hub 7-in-1', sku: 'SKU-042', category: 'Electronics', vendor_id: 3, reorder_level: 20, current_stock: 2, unit_price: 49.99 }, forecast_date: '', predicted_qty: 100, confidence: 0.88, risk_level: 'CRITICAL', created_at: '' },
        ] as any[];
    }
}