;; Music Purchase Smart Contract
;; Written in Clarity for use with Clarinet

;; Define constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-invalid-music (err u101))
(define-constant err-insufficient-payment (err u102))
(define-constant err-already-purchased (err u103))

;; Define music collections with prices (in microSTX)
(define-map music-prices
  { music-id: uint }
  { 
    name: (string-ascii 50),
    price: uint,
    available: bool 
  }
)

;; Track user purchases
(define-map user-purchases
  { user: principal, music-id: uint }
  { purchased: bool, purchase-id: uint }
)

;; Counter for purchase IDs
(define-data-var next-purchase-id uint u1)

;; Track total sales
(define-data-var total-sales uint u0)

;; Initialize music collections
(map-set music-prices { music-id: u1 } 
  { name: "Classical Collection", price: u9990000, available: true })

(map-set music-prices { music-id: u2 } 
  { name: "Jazz Classics", price: u12990000, available: true })

(map-set music-prices { music-id: u3 } 
  { name: "Golden Oldies", price: u8990000, available: true })

;; Public function to purchase music
(define-public (purchase-music (music-id uint))
  (let (
    (music-info (unwrap! (map-get? music-prices { music-id: music-id }) err-invalid-music))
    (purchase-key { user: tx-sender, music-id: music-id })
    (existing-purchase (map-get? user-purchases purchase-key))
  )
    ;; Check if music exists and is available
    (asserts! (get available music-info) err-invalid-music)
    
    ;; Check if user hasn't already purchased this music
    (asserts! (is-none existing-purchase) err-already-purchased)  
    ;; Transfer payment to contract
    (try! (stx-transfer? (get price music-info) tx-sender contract-owner))
    
    ;; Get current purchase ID and increment counter
    (let ((current-purchase-id (var-get next-purchase-id)))
      ;; Record the purchase
      (map-set user-purchases purchase-key 
        { purchased: true, purchase-id: current-purchase-id })
      ;; Increment purchase counter
      (var-set next-purchase-id (+ current-purchase-id u1))
      
      ;; Update total sales
      (var-set total-sales (+ (var-get total-sales) (get price music-info)))
      
      ;; Return success with purchase details
      (ok { 
        music-name: (get name music-info),
        price-paid: (get price music-info),
        purchase-id: current-purchase-id
      })
    )
  )
)

;; Read-only function to get music info
(define-read-only (get-music-info (music-id uint))
  (map-get? music-prices { music-id: music-id })
)

;; Read-only function to check if user owns music
(define-read-only (has-purchased (user principal) (music-id uint))
  (default-to false 
    (get purchased (map-get? user-purchases { user: user, music-id: music-id }))
  )
)

;; Read-only function to get all available music
(define-read-only (list-available-music)
  (list 
    (map-get? music-prices { music-id: u1 })
    (map-get? music-prices { music-id: u2 })
    (map-get? music-prices { music-id: u3 })
  )
)

;; Read-only function to get total sales (owner only)
(define-read-only (get-total-sales)
  (var-get total-sales)
)

;; Admin function to add new music
(define-public (add-music (music-id uint) (name (string-ascii 50)) (price uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (map-set music-prices { music-id: music-id } 
      { name: name, price: price, available: true }))
  )
)

;; Admin function to toggle music availability
(define-public (toggle-music-availability (music-id uint))
  (let (
    (music-info (unwrap! (map-get? music-prices { music-id: music-id }) err-invalid-music))
  )
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (map-set music-prices { music-id: music-id }
      (merge music-info { available: (not (get available music-info)) })
    ))
  )
)

;; Function to withdraw earnings (owner only)
(define-public (withdraw-earnings (amount uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (try! (as-contract (stx-transfer? amount tx-sender contract-owner)))
    (ok amount)
  )
)