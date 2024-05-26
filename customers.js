document.addEventListener('DOMContentLoaded', () => {
    const customerTable = document.getElementById('customerTable');

    const fetchCustomers = () => {
        fetch('/api/customers')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                customerTable.innerHTML = '';
                data.forEach(customer => {
                    const item = document.createElement('div');
                    item.className = 'gridlist-item';
                    const content = document.createElement('div');
                    content.className = 'gridlist-item-content';
                    content.innerHTML = `
                        <h2>${customer.name}</h2>
                        <p>${customer.address}</p>
                        <p>${customer.email}</p>
                        <p>${customer.phone}</p>
                    `;
                    item.appendChild(content);
                    customerTable.appendChild(item);
                });
            })
            .catch(error => console.error('Error:', error));
    };

    fetchCustomers();

    document.getElementById('refreshButton').addEventListener('click', fetchCustomers);

    document.getElementById('importButton').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx, .xls';
        input.onchange = e => {
            const file = e.target.files[0];
            if (file) {
                const formData = new FormData();
                formData.append('importFile', file);
                fetch('/api/import', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.text())
                .then(data => {
                    console.log('Import successful:', data);
                    fetchCustomers();
                })
                .catch(error => console.error('Error:', error));
            }
        };
        input.click();
    });

    document.getElementById('exportButton').addEventListener('click', () => {
        const fileName = prompt('Enter file name for export:', 'customers');
        if (fileName) {
            window.location.href = `/api/export?name=${fileName}.xlsx`;
        }
    });
});