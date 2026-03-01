import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../shared/services/api.service';
import { NotificationService } from '../shared/services/notification.service';
import { StockTransaction, Product } from '../shared/models/interfaces';

@Component({
    selector: 'app-transactions',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule],
    templateUrl: './transactions.component.html',
    styleUrls: ['./transactions.component.scss']
})
export class TransactionsComponent implements OnInit {

    activeTab: 'IN' | 'OUT' | 'HISTORY' = 'IN';
    transactions: StockTransaction[] = [];
    products: Product[] = [];
    loading = false;
    submitting = false;

    inForm!: FormGroup;
    outForm!: FormGroup;

    filterType = '';
    page = 1;
    limit = 15;
    total = 0;

    get totalPages() { return Math.max(1, Math.ceil(this.total / this.limit)); }
    prevPage() { if (this.page > 1) { this.page--; this.loadTransactions(); } }
    nextPage() { if (this.page < this.totalPages) { this.page++; this.loadTransactions(); } }

    constructor(
        private api: ApiService,
        private notify: NotificationService,
        private fb: FormBuilder
    ) { }

    ngOnInit() {
        this.buildForms();
        this.loadProducts();
        this.loadTransactions();
    }

    buildForms() {
        const now = new Date().toISOString().slice(0, 16);
        this.inForm = this.fb.group({
            product_id: ['', Validators.required],
            quantity: ['', [Validators.required, Validators.min(1)]],
            notes: [''],
            timestamp: [now]
        });
        this.outForm = this.fb.group({
            product_id: ['', Validators.required],
            quantity: ['', [Validators.required, Validators.min(1)]],
            notes: [''],
            timestamp: [now]
        });
    }

    loadProducts() {
        this.api.getProducts({ limit: 200 }).subscribe({
            next: res => this.products = res.data,
            error: () => { }
        });
    }

    loadTransactions() {
        this.loading = true;
        const filters: any = { page: this.page, limit: this.limit };
        if (this.filterType) filters.type = this.filterType;

        this.api.getTransactions(filters).subscribe({
            next: res => {
                this.transactions = res.data;
                this.total = res.total;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
                this.transactions = this.demoTx();
                this.total = this.demoTx().length;
            }
        });
    }

    submitIn() {
        if (this.inForm.invalid) { this.inForm.markAllAsTouched(); return; }
        this.submitting = true;
        this.api.createTransaction({ ...this.inForm.value, type: 'IN' }).subscribe({
            next: res => {
                this.notify.success(`✅ Stock-In recorded! Updated stock: ${res.updatedStock}`);
                this.inForm.reset({ timestamp: new Date().toISOString().slice(0, 16) });
                this.loadTransactions();
                this.submitting = false;
            },
            error: err => {
                this.notify.error(err.error?.error || 'Failed to record Stock-In');
                this.submitting = false;
            }
        });
    }

    submitOut() {
        if (this.outForm.invalid) { this.outForm.markAllAsTouched(); return; }
        this.submitting = true;
        this.api.createTransaction({ ...this.outForm.value, type: 'OUT' }).subscribe({
            next: res => {
                this.notify.success(`📤 Stock-Out recorded! Remaining: ${res.updatedStock}`);
                this.outForm.reset({ timestamp: new Date().toISOString().slice(0, 16) });
                this.loadTransactions();
                this.submitting = false;
            },
            error: err => {
                this.notify.error(err.error?.error || 'Failed to record Stock-Out');
                this.submitting = false;
            }
        });
    }

    switchTab(tab: 'IN' | 'OUT' | 'HISTORY') {
        this.activeTab = tab;
        if (tab === 'HISTORY') { this.page = 1; this.loadTransactions(); }
    }

    private demoTx(): StockTransaction[] {
        return [
            { id: 1024, product_id: 1, Product: { id: 1, name: 'Laptop Stand Pro', sku: 'SKU-001', category: 'Electronics', vendor_id: null, reorder_level: 15, current_stock: 5, unit_price: 29.99 }, quantity: 50, type: 'IN', timestamp: '2026-01-15T09:30:00', handled_by: 1 },
            { id: 1023, product_id: 3, Product: { id: 3, name: 'USB-C Hub 7-in-1', sku: 'SKU-042', category: 'Electronics', vendor_id: null, reorder_level: 20, current_stock: 2, unit_price: 49.99 }, quantity: 10, type: 'OUT', timestamp: '2026-01-14T14:22:00', handled_by: 1 },
            { id: 1022, product_id: 4, Product: { id: 4, name: 'Wireless Keyboard', sku: 'SKU-087', category: 'Electronics', vendor_id: null, reorder_level: 25, current_stock: 8, unit_price: 79.99 }, quantity: 30, type: 'IN', timestamp: '2026-01-12T11:05:00', handled_by: 1 },
            { id: 1021, product_id: 5, Product: { id: 5, name: 'Monitor 27" 4K', sku: 'SKU-103', category: 'Electronics', vendor_id: null, reorder_level: 5, current_stock: 0, unit_price: 599 }, quantity: 5, type: 'OUT', timestamp: '2026-01-10T16:48:00', handled_by: 1 },
            { id: 1020, product_id: 6, Product: { id: 6, name: 'A4 Paper 500pk', sku: 'SKU-120', category: 'Supplies', vendor_id: null, reorder_level: 50, current_stock: 200, unit_price: 12.99 }, quantity: 100, type: 'IN', timestamp: '2026-01-09T08:15:00', handled_by: 1 },
        ] as any[];
    }
}