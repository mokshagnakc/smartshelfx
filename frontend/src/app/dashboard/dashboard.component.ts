import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../shared/services/api.service';
import { AuthService } from '../shared/services/auth.service';
import { AnalyticsSummary, Alert, PurchaseOrder, Product } from '../shared/models/interfaces';

Chart.register(...registerables);

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('trendCanvas') trendCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('categoryCanvas') categoryCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('orderStatusCanvas') orderStatusCanvas!: ElementRef<HTMLCanvasElement>;

    private trendChart?: Chart;
    private categoryChart?: Chart;
    private orderStatusChart?: Chart;

    summary: AnalyticsSummary = { totalProducts: 0, lowStockItems: 0, outOfStockItems: 0, pendingOrders: 0 };
    recentAlerts: Alert[] = [];
    recentOrders: PurchaseOrder[] = [];
    lowStockItems: Product[] = [];
    loading = true;

    private chartsReady = false;
    private txInData: number[] = [];
    private txOutData: number[] = [];
    private txLabels: string[] = [];
    private catLabels: string[] = [];
    private catData: number[] = [];
    orderStatusData: number[] = [0, 0, 0, 0];

    constructor(public auth: AuthService, private api: ApiService, private cdr: ChangeDetectorRef) { }

    get isAdmin() { return this.auth.getRole() === 'ADMIN'; }
    get isManager() { return this.auth.getRole() === 'MANAGER'; }
    get isVendor() { return this.auth.getRole() === 'VENDOR'; }

    ngOnInit() { this.loadData(); }
    ngAfterViewInit() { this.chartsReady = true; this.tick(); }
    ngOnDestroy() { this.trendChart?.destroy(); this.categoryChart?.destroy(); this.orderStatusChart?.destroy(); }

    tick() { this.cdr.detectChanges(); setTimeout(() => this.tryBuildCharts(), 60); }

    loadData() {
        this.loading = true;
        this.api.getAnalyticsSummary().subscribe({ next: s => { this.summary = s; }, error: () => { } });
        this.api.getAlerts({ is_read: false, limit: 5 }).subscribe({ next: r => { this.recentAlerts = r.data; }, error: () => { } });
        this.api.getOrders({ limit: 5 }).subscribe({
            next: r => { this.recentOrders = r.data; this.buildOrderStatusData(r.data); this.loading = false; this.tick(); },
            error: () => { this.loading = false; }
        });
        if (!this.isVendor) {
            this.api.getProducts({ status: 'low', limit: 6 }).subscribe({ next: r => { this.lowStockItems = r.data; }, error: () => { } });
            this.api.getTransactions({ limit: 200 }).subscribe({
                next: r => { this.buildTrendData(r.data || []); this.tick(); },
                error: () => { this.txLabels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6']; this.txInData = [0, 0, 0, 0, 0, 0]; this.txOutData = [0, 0, 0, 0, 0, 0]; this.tick(); }
            });
            this.api.getProducts({ limit: 200 }).subscribe({
                next: r => { this.buildCategoryData(r.data || []); this.tick(); },
                error: () => { }
            });
        }
    }

    buildTrendData(transactions: any[]) {
        const weeks: Record<string, { in: number; out: number }> = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) weeks['W' + (6 - i)] = { in: 0, out: 0 };
        transactions.forEach(tx => {
            const diff = Math.floor((now.getTime() - new Date(tx.timestamp).getTime()) / 86400000);
            const wIdx = Math.floor(diff / 7);
            const lbl = 'W' + (6 - wIdx);
            if (wIdx >= 0 && wIdx < 6 && weeks[lbl]) {
                if (tx.type === 'IN') weeks[lbl].in += tx.quantity;
                if (tx.type === 'OUT') weeks[lbl].out += tx.quantity;
            }
        });
        this.txLabels = Object.keys(weeks);
        this.txInData = Object.values(weeks).map(w => w.in);
        this.txOutData = Object.values(weeks).map(w => w.out);
    }

    buildCategoryData(products: any[]) {
        const cats: Record<string, number> = {};
        products.forEach(p => { cats[p.category] = (cats[p.category] || 0) + (p.current_stock || 0); });
        this.catLabels = Object.keys(cats);
        this.catData = Object.values(cats);
    }

    buildOrderStatusData(orders: any[]) {
        const c = [0, 0, 0, 0];
        orders.forEach(o => {
            if (o.status === 'PENDING') c[0]++;
            if (o.status === 'APPROVED') c[1]++;
            if (o.status === 'DISPATCHED') c[2]++;
            if (o.status === 'DELIVERED') c[3]++;
        });
        this.orderStatusData = c;
    }

    tryBuildCharts() {
        if (!this.chartsReady) return;
        if (!this.isVendor) {
            if (this.trendCanvas?.nativeElement) this.buildTrendChart();
            if (this.categoryCanvas?.nativeElement) this.buildCategoryChart();
        }
        if (this.isVendor && this.orderStatusCanvas?.nativeElement) this.buildOrderStatusChart();
    }

    buildTrendChart() {
        this.trendChart?.destroy();
        this.trendChart = new Chart(this.trendCanvas.nativeElement.getContext('2d')!, {
            type: 'line',
            data: {
                labels: this.txLabels, datasets: [
                    { label: 'Stock In', data: this.txInData, borderColor: '#00b4ff', backgroundColor: 'rgba(0,180,255,0.08)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#00b4ff' },
                    { label: 'Stock Out', data: this.txOutData, borderColor: '#00ffcc', backgroundColor: 'rgba(0,255,204,0.05)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#00ffcc' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: 'rgba(255,255,255,0.55)', boxWidth: 12, font: { size: 12 } } } },
                scales: { x: { ticks: { color: 'rgba(255,255,255,0.45)' }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { beginAtZero: true, ticks: { color: 'rgba(255,255,255,0.45)' }, grid: { color: 'rgba(255,255,255,0.06)' } } }
            }
        });
    }

    buildCategoryChart() {
        this.categoryChart?.destroy();
        const colors = ['#00b4ff', '#00ffcc', '#ffaa00', '#ff4d6d', '#a855f7', '#f97316', '#06b6d4', '#84cc16'];
        this.categoryChart = new Chart(this.categoryCanvas.nativeElement.getContext('2d')!, {
            type: 'doughnut',
            data: { labels: this.catLabels.length ? this.catLabels : ['No Data'], datasets: [{ data: this.catData.length ? this.catData : [1], backgroundColor: this.catLabels.length ? colors.slice(0, this.catLabels.length) : ['rgba(255,255,255,0.1)'], borderWidth: 0, hoverOffset: 8 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.55)', boxWidth: 10, font: { size: 11 }, padding: 12 } } } }
        });
    }

    buildOrderStatusChart() {
        this.orderStatusChart?.destroy();
        this.orderStatusChart = new Chart(this.orderStatusCanvas.nativeElement.getContext('2d')!, {
            type: 'doughnut',
            data: { labels: ['Pending', 'Approved', 'Dispatched', 'Delivered'], datasets: [{ data: this.orderStatusData, backgroundColor: ['#ffaa00', '#00b4ff', '#a855f7', '#00ffcc'], borderWidth: 0, hoverOffset: 8 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.55)', boxWidth: 10, font: { size: 11 }, padding: 10 } } } }
        });
    }

    getStatusClass(stock: number, reorder: number): string {
        if (stock === 0) return 'out';
        if (stock <= reorder / 2) return 'crit';
        if (stock <= reorder) return 'low';
        return 'ok';
    }

    getStatusLabel(stock: number, reorder: number): string {
        if (stock === 0) return 'Out of Stock';
        if (stock <= reorder / 2) return 'Critical';
        if (stock <= reorder) return 'Low Stock';
        return 'In Stock';
    }

    getOrderClass(status: string): string {
        const map: Record<string, string> = { PENDING: 'pend', APPROVED: 'appr', DISPATCHED: 'disp', DELIVERED: 'ok', CANCELLED: 'crit' };
        return map[status] || 'pend';
    }
}