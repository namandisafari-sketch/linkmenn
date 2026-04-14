-- Update stock levels and buying prices for Abucus Pharmacy invoice #44532
UPDATE products SET stock = stock + 30, buying_price = 610 WHERE id = 'cda1d112-fd3a-4764-b90c-59c3f66628bf';
UPDATE products SET stock = stock + 1, buying_price = 20000 WHERE id = 'b39e7fed-38c1-4480-b1d1-00968d1a2635';
UPDATE products SET stock = stock + 1, buying_price = 50000 WHERE id = 'd6bba966-8409-448d-8ee6-4c341eba584a';
UPDATE products SET stock = stock + 1, buying_price = 2700 WHERE id = '0041cd9c-811c-4406-b4af-f992a7f494bd';
UPDATE products SET stock = stock + 5, buying_price = 2500 WHERE id = '56a4c9fe-0a69-40d1-93d0-c87b2876819c';
UPDATE products SET stock = stock + 1, buying_price = 11500 WHERE id = '93d63d87-476a-4f89-8040-36eeb146df11';
UPDATE products SET stock = stock + 1, buying_price = 2800 WHERE id = '5e221d17-57f2-4ecf-a68c-7643490b9625';
UPDATE products SET stock = stock + 2, buying_price = 1200 WHERE id = '114b6221-517a-43db-b5b1-9170b2ae44f1';
UPDATE products SET stock = stock + 1, buying_price = 6000 WHERE id = 'a5703f7b-2c73-4425-a130-5b9009f506b8';
UPDATE products SET stock = stock + 3, buying_price = 11800 WHERE id = '6b67dbc2-7741-46f3-941e-cfdb12b9d189';
UPDATE products SET stock = stock + 20, buying_price = 2200 WHERE id = '1228fc13-607d-419f-80ca-c4d2ab2bd3e8';
UPDATE products SET stock = stock + 20, buying_price = 1430 WHERE id = '4da10c8d-9ba7-4c51-98bc-2800f3487113';
UPDATE products SET stock = stock + 3, buying_price = 2100 WHERE id = '64300025-563e-4a0b-9839-758428310fb3';
UPDATE products SET stock = stock + 2, buying_price = 1200 WHERE id = '29316a80-d9cc-40f0-bc39-cb81d743a13a';
UPDATE products SET stock = stock + 2, buying_price = 3300 WHERE id = 'eb50404b-bb02-4d28-bbc8-611acd3e7d49';
UPDATE products SET stock = stock + 2, buying_price = 1200 WHERE id = '0b28ffdf-3e68-423c-9cbd-b7368204cc58';
UPDATE products SET stock = stock + 100, buying_price = 170 WHERE id = 'fee02f3a-6364-4f37-869d-01c06825108e';
UPDATE products SET stock = stock + 2, buying_price = 5800 WHERE id = '76fb6a9d-f72d-4ce2-83ea-484acfd1b72f';
UPDATE products SET stock = stock + 1, buying_price = 5500 WHERE id = '41d32664-c3fa-4203-aa1f-1896ee6140e2';
UPDATE products SET stock = stock + 2, buying_price = 2300 WHERE id = '9847eeff-3795-4654-a385-25b56deaa2ef';
UPDATE products SET stock = stock + 10, buying_price = 1650 WHERE id = '23bc255a-b6ae-45a1-83d2-8367facf4c52';
UPDATE products SET stock = stock + 1, buying_price = 4200 WHERE id = 'dc762c5a-4351-40f7-9d6a-2d33630c6e8d';

-- Fix the diclofenac voucher item
UPDATE voucher_items SET product_id = '0b28ffdf-3e68-423c-9cbd-b7368204cc58' WHERE voucher_id = '5e61c802-b5e5-4e84-9779-58f63917eb26' AND description = '05524';