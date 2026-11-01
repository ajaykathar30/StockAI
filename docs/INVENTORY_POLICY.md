# QuickStock AI: Inventory Policy & Simulation Engine

Auditable Replenishment Decision Logic and Continuous Ledger Simulation.

---

## 1. Auditable Periodic-Review Replenishment Policy (R, S)

Quick-commerce dark stores operate under daily periodic review. Replenishment orders are placed every $R$ days with a supplier lead time of $L$ days.

### Protection Period
The dark store must protect against demand variability over the entire protection horizon:

$$\text{Protection Period} = L + R \quad (\text{days})$$

### Target Stock Level ($S$)
$$\text{Target Stock} (S) = \sum_{t=1}^{L+R} \hat{y}_t + \text{Safety Stock}$$

Where:
- $\hat{y}_t$ is the recursive point demand forecast for day $t$.
- $\text{Safety Stock} = \left\lceil z \cdot \sigma_{\text{daily}} \cdot \sqrt{L+R} \right\rceil$
- $z$ is the standard normal quantile corresponding to the configured target service level (e.g. $z = 1.645$ for 95%, $z = 2.05$ for 98%).
- $\sigma_{\text{daily}}$ is derived from the model's empirical prediction residual standard error.

### Inventory Position ($I_{\text{pos}}$)
$$I_{\text{pos}} = I_{\text{usable\_on\_hand}} + I_{\text{confirmed\_on\_order}} - I_{\text{committed}}$$

### Raw Replenishment Need
$$\text{Raw Order} = \max\left(0, S - I_{\text{pos}}\right)$$

---

## 2. Constraints & Pack-Rounding Mechanics

### Crucial MOQ Invariant
> **Academic Integrity Rule**: An initial requirement of zero must NEVER become a positive order merely because an MOQ exists.

$$\text{If Raw Order} = 0 \implies \text{Final Order} = 0$$

### Case-Pack Rounding & MOQ Enforcement
If $\text{Raw Order} > 0$:
1. Round up to the nearest case pack:
   $$\text{Pack Rounded} = \left\lceil \frac{\text{Raw Order}}{\text{Case Pack Size}} \right\rceil \times \text{Case Pack Size}$$
2. Enforce Minimum Order Quantity:
   $$\text{Final Order} = \max\left(\text{Pack Rounded}, \text{MOQ}\right)$$

### Perishability & Shelf-Life Capping
For perishable categories (Dairy, Bakery, Fresh Produce), stock arriving today must not exceed absorbable customer demand prior to expiration:

$$\text{Max Perishable Order} = \max\left(0, \left(\text{Daily Demand} \times \text{Shelf Life Days}\right) - I_{\text{usable\_on\_hand}}\right)$$

If $\text{Raw Order} > \text{Max Perishable Order}$, the quantity is capped to avoid guaranteed spoilage, and an `expiry_risk_units` warning is flagged.

### Capacity & Budget Constraints
- **Warehouse Capacity**: If total units exceed dark store capacity, order quantities are scaled proportionally with explicit warning flags.
- **Daily Budget**: If total procurement expenditure exceeds purchasing limits, quantities are scaled proportionally with audit notices.

---

## 3. Discrete-Event Inventory Simulator

The simulation engine maintains a **continuous, unbroken inventory ledger** across historical evaluation test dates without resetting daily stock to source dataset values:

For each simulated day $t$:
1. **Inbound Delivery**: Orders placed at day $t - L$ mature and are added to usable on-hand stock.
2. **Perishable Expiration**: Inventory batches reaching expiry date $t$ are discarded and logged as expired units.
3. **Demand Realization**: Ground truth customer demand $D_t$ occurs.
4. **Fulfillment**: $\text{Fulfilled}_t = \min(I_{\text{available}}, D_t)$.
5. **Stockout / Lost Sales**: $\text{Lost Sales}_t = D_t - \text{Fulfilled}_t$.
6. **End-of-Day Stock**: $I_{\text{end}} = I_{\text{available}} - \text{Fulfilled}_t$.
7. **Cost Ledger**:
   $$\text{Holding Cost} = I_{\text{end}} \times C_{\text{holding}}$$
   $$\text{Shortage Penalty} = \text{Lost Sales}_t \times C_{\text{shortage}}$$
   $$\text{Waste Cost} = \text{Expired Units} \times C_{\text{purchase}}$$
   $$\text{Ordering Cost} = \mathbb{I}(\text{Order Placed}) \times C_{\text{placement}}$$
8. **Replenishment Review**: Policy rules evaluate $I_{\text{pos}}$ and place orders to arrive at $t + L$.
