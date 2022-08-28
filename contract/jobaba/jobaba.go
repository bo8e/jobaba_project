package main
//1.import
import (
	"encoding/json"
	"fmt"
	"time"
	"log"
	"github.com/golang/protobuf/ptypes"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)
//2.chaincode 구조체-contractapi.Contract상속
type SmartContract struct {
	contractapi.Contract
}
//3.stock 구조체 추가
type Stock struct {
	Id string `json:"id"`
	Price float64 `json:"price"`
	Seller_shop string `json:"seller_shop"`
	Buyer_shop string `json:"buyer_shop"`
	Info string `json:"info"`
	Status string  `json:"status"`
}
//history 결과 저장 구조체
type HistoryQueryResult struct {
	Record   *Stock   `json:"record"`
	TxId     string   `json:"txId"`
	Timestamp time.Time `json:"timestamp"`
	//거래여부
	IsDelete  bool     `json:"isDelete"`
}
//4.get 메서드 구현
func (S *SmartContract) QueryStock(ctx contractapi.TransactionContextInterface, id string) (*Stock, error) {
	stockAsBytes, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("Failed to read from world state.%s", err.Error())
	}
	
	if stockAsBytes == nil {
			return nil, fmt.Errorf("%s does not exist", id)
	}
	stock := new(Stock)
	_ =json.Unmarshal(stockAsBytes, stock)
	return stock, nil
}
 
//5.set 메서드 구현
func (s *SmartContract) RegisterStock(ctx contractapi.TransactionContextInterface, id string, price float64, seller_shop string, info string)  error {
	stock := Stock{
		Id :id,
		Price:price,
		Seller_shop:seller_shop,
		Info:info,
		Status:"registered",
	}
	stockAsBytes, _ := json.Marshal(stock)
	return ctx.GetStub().PutState(id, stockAsBytes)
}
                                                                                  //buyer의 id?
func (s *SmartContract) RequestStock(ctx contractapi.TransactionContextInterface, id string, buyer string)  error {
	// 1. Getstate -> 오류처리
	// 3. 요청등록 상태를 -> "requested"
	
	stock, err := s.QueryStock(ctx, id)
	if err != nil {
		return err
	}
 
 
//// 2. "registered" 상태검증
	if stock.Status != "registered" {
		return fmt.Errorf("stock is not registered")
	}
 
	stock.Status = "requested"
	stock.Buyer_shop = buyer
 
	toAsBytes, _ := json.Marshal(stock)
	ctx.GetStub().PutState(id, toAsBytes)
	return nil
}
                                                                                 // id=바이어
func (s *SmartContract) ConfirmStock(ctx contractapi.TransactionContextInterface, id string, seller string)  error {
	// 1. Getstate -> 오류처리
	// 3. 요청등록 상태를 -> "requested"
	
	stock, err := s.QueryStock(ctx, id)
	if err != nil {
		return err
	}
 
//// 2. "confirmed" 상태검증- 구매자의 의사
	if stock.Status != "confirmed" {
		return fmt.Errorf("i dont want to buy... ")
	}
 
	stock.Status = "confirmed"
	stock.Seller_shop = seller
 
	toAsBytes, _ := json.Marshal(stock)
	ctx.GetStub().PutState(id, toAsBytes)
	return nil
}
//6.History
func (t *SmartContract) GetHistory(ctx contractapi.TransactionContextInterface, key string) ([]HistoryQueryResult, error) {
	log.Printf("GetHistory: ID %v", key)
 
	resultsIterator, err := ctx.GetStub().GetHistoryForKey(key)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()
 
	var records []HistoryQueryResult
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
 
		var asset Stock
		if len(response.Value) > 0 {
			err = json.Unmarshal(response.Value, &asset)
			if err != nil {
				return nil, err
			}
		} else {
			asset =Stock{
				Id: key,
			}
		}
 
		timestamp, err := ptypes.Timestamp(response.Timestamp)
		if err != nil {
			return nil, err
		}
 
		record := HistoryQueryResult{
			TxId:    response.TxId,
			Timestamp: timestamp,
			Record:   &asset,
			IsDelete: response.IsDelete,
		}
 
		records= append(records, record)
	}
	return records, nil
}
 
//8.main 
func main() {
	chaincode, err := contractapi.NewChaincode(new(SmartContract))
	if err != nil {
		fmt.Printf("Error create jababa chaincode: %s", err.Error())
		return
	}
	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting jababa chaincode: %s", err.Error())
	}
}