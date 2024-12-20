def calculate_rank_shift(list1: list, list2: list, top_n: int = 20) -> float:
    shift = 0
    for rank_first, doc_id in enumerate(list1[:top_n], 1):
        try:
            rank_second = list2.index(doc_id) + 1
        except ValueError:
            rank_second = len(list2)  # Document not found in second list

        shift += (rank_first - rank_second) ** 2 / (rank_first * rank_second)

    return shift / top_n
