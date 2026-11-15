
let products = [];
let cart = [];

// Load products from JSON
async function loadProducts() {
    try {
        const response = await fetch("price.json");

        if (!response.ok) {
            throw new Error("Could not load price.json");
        }

        products = await response.json();

        displayProducts(products);

    } catch (error) {
        document.getElementById("productList").innerHTML =
            "Error loading products. Please check price.json and run using a local server.";
        console.error(error);
    }
}

// Display all products
function displayProducts(items) {
    const list = document.getElementById("productList");

    list.innerHTML = "";

    if (items.length === 0) {
        list.innerHTML = "<p>No products found.</p>";
        return;
    }

    items.forEach(product => {
        const div = document.createElement("div");

        div.className = "product";

        const name = document.createElement("strong");
        name.classList.add("itemName")
        name.textContent = product.name;

        const price = document.createElement("span");
        price.textContent = "₹" + Number(product.price).toFixed(2);

        const button = document.createElement("button");
        button.textContent = "Add +";
        button.onclick = () => addToCart(product.id);

        div.append(name, price, button);
        list.appendChild(div);
    });
}

// Search products
document.getElementById("search").addEventListener("input", function() {
    const value = this.value.toLowerCase();

    const filtered = products.filter(product =>
        product.name.toLowerCase().includes(value)
    );

    displayProducts(filtered);
});

// Add item to cart
function addToCart(id) {
    const product = products.find(p => p.id === id);

    if (!product) return;

    const existing = cart.find(item => item.id === id);

    if (existing) {
        existing.qty++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            qty: 1
        });
    }

    displayCart();
}

// Increase quantity
function increaseQty(id) {
    const item = cart.find(p => p.id === id);

    if (item) {
        item.qty++;
    }

    displayCart();
}

// Decrease quantity
function decreaseQty(id) {
    const item = cart.find(p => p.id === id);

    if (!item) return;

    item.qty--;

    if (item.qty <= 0) {
        cart = cart.filter(p => p.id !== id);
    }

    displayCart();
}

// Remove item
function removeItem(id) {
    cart = cart.filter(p => p.id !== id);
    displayCart();
}

// Display cart
function displayCart() {
    const tbody = document.getElementById("cartItems");

    tbody.innerHTML = "";

    cart.forEach(item => {
        const tr = document.createElement("tr");

        const values = [
            item.name,
            "₹" + item.price.toFixed(2),
            null,
            "₹" + (item.price * item.qty).toFixed(2),
            null
        ];

        values.forEach((value, index) => {
            const td = document.createElement("td");

            if (index === 0) {
                td.classList.add("itemName")
                td.textContent = value;
            } else if (index === 2) {
                const minus = document.createElement("button");
                minus.textContent = "-";
                minus.className = "qty-btn";
                minus.onclick = () => decreaseQty(item.id);

                const quantity = document.createTextNode(" " + item.qty + " ");

                const plus = document.createElement("button");
                plus.textContent = "+";
                plus.className = "qty-btn";
                plus.onclick = () => increaseQty(item.id);

                td.append(minus, quantity, plus);

            } else if (index === 4) {
                const remove = document.createElement("button");
                remove.textContent = "X";
                remove.className = "remove-btn";
                remove.onclick = () => removeItem(item.id);

                td.appendChild(remove);

            } else {
                td.textContent = value;
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    updateTotal();
}

// Calculate grand total
function updateTotal() {
    const total = cart.reduce(
        (sum, item) => sum + item.price * item.qty,
        0
    );

    document.getElementById("grandTotal").textContent =
        total.toFixed(2);
}

// Clear cart
function clearCart() {
    document.getElementById("confirmPopup").style.display = "flex";
}

// Close popup
function closePopup() {
    document.getElementById("confirmPopup").style.display = "none";
}

// Confirm and clear cart
function confirmClearCart() {
    cart = [];
    displayCart();
    document.getElementById("invoice").innerHTML = ""
    document.getElementById("invoice").style = "display:none;"
    closePopup();
}

// Generate invoice
function generateBill() {
    if (cart.length === 0) {
        return;
    }

    const total = cart.reduce(
        (sum, item) => sum + item.price * item.qty,
        0
    );

    const invoice = document.getElementById("invoice");

    const date = new Date().toLocaleString("en-IN");

    const rows = cart.map(item => `
        <tr>
            <td class="itemName">${escapeHTML(item.name)}</td>
            <td>₹${item.price.toFixed(2)}</td>
            <td>${item.qty}</td>
            <td>₹${(item.price * item.qty).toFixed(2)}</td>
        </tr>
    `).join("");

    invoice.innerHTML = `
        <h2>MY SHOP</h2>
        <p style="text-align:center">Customer Invoice</p>
        <hr>

        <p><strong>Invoice Date:</strong> ${date}</p>

        <table>
            <thead>
                <tr>
                    <th>Item Name</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Amount</th>
                </tr>
            </thead>

            <tbody>
                ${rows}
            </tbody>
        </table>

        <div class="invoice-total">
            <h2>Grand Total: ₹${total.toFixed(2)}</h2>
        </div>

        <hr>
        <p style="text-align:center">
            Thank You! Visit Again.
        </p>

        <p id="printBillBtn" style="text-align:center">
            <button onclick="window.print()">Print Bill</button>
        </p>
    `;

    invoice.style.display = "block";

    window.print();
}

// Escape product names before inserting into invoice HTML
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Start application
loadProducts();
